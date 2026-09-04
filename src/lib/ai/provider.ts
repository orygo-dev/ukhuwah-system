import { decrypt } from "@/lib/encryption";
import {
  GEMINI_FALLBACK_MODELS,
  isPlaceholderKey,
  looksEncryptedBlob,
  normalizeGeminiModel,
} from "@/lib/ai/constants";
import { formatAiProviderError } from "@/lib/ai/api-errors";
import { composeModulAjarMarkdown } from "@/lib/templates/modul-ajar";
import type { AiProvider } from "@prisma/client";
import {
  estimateTokensFromMessagesAndContent,
  normalizeGeminiUsage,
  normalizeOpenAiUsage,
  recordAiUsage,
  type AiUsageContext,
  type NormalizedAiUsage,
} from "@/lib/ai/usage-tracking";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderCallResult = {
  content: string;
  providerSlug: string;
  providerName: string;
  model: string;
  usage: NormalizedAiUsage;
  latencyMs: number;
};

export type ProviderConfig = {
  slug: string;
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  maxTokens: number;
  temperature: number;
};

export function resolveApiKey(encryptedOrPlain: string): string {
  if (!encryptedOrPlain) return "";
  try {
    const decrypted = decrypt(encryptedOrPlain);
    if (decrypted && !isPlaceholderKey(decrypted)) return decrypted;
  } catch {
    // not encrypted with current key
  }
  if (looksEncryptedBlob(encryptedOrPlain)) return "";
  return isPlaceholderKey(encryptedOrPlain) ? "" : encryptedOrPlain;
}

export function toConfig(provider: AiProvider, modelOverride?: string | null): ProviderConfig {
  const apiKey = resolveApiKey(provider.apiKey);
  let model = modelOverride || provider.defaultModel;
  if (provider.slug === "gemini") {
    model = normalizeGeminiModel(model);
  }

  return {
    slug: provider.slug,
    apiKey,
    baseUrl: provider.baseUrl,
    model,
    maxTokens: provider.maxTokens,
    temperature: Number(provider.temperature),
  };
}

export function providerHasValidKey(provider: AiProvider): boolean {
  const key = resolveApiKey(provider.apiKey);
  return key.length > 8 && !isPlaceholderKey(key);
}

async function callOpenAICompatible(
  config: ProviderConfig,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>
): Promise<ProviderCallResult> {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const startedAt = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatAiProviderError(config.slug, res.status, err));
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "";
  const usage = json.usage
    ? normalizeOpenAiUsage(json)
    : estimateTokensFromMessagesAndContent(messages, content);
  return {
    content,
    providerSlug: config.slug,
    providerName: config.slug,
    model: config.model,
    usage,
    latencyMs: Date.now() - startedAt,
  };
}

async function callAnthropic(config: ProviderConfig, messages: ChatMessage[]): Promise<ProviderCallResult> {
  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMessages = messages.filter((m) => m.role !== "system");
  const startedAt = Date.now();

  const res = await fetch(
    config.baseUrl || "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        system,
        messages: userMessages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatAiProviderError("anthropic", res.status, err));
  }

  const json = await res.json();
  const content = json.content?.[0]?.text || "";
  const inputTokens = Number(json.usage?.input_tokens);
  const outputTokens = Number(json.usage?.output_tokens);
  const usage: NormalizedAiUsage =
    Number.isFinite(inputTokens) || Number.isFinite(outputTokens)
      ? {
          inputTokens: Number.isFinite(inputTokens) ? inputTokens : null,
          outputTokens: Number.isFinite(outputTokens) ? outputTokens : null,
          reasoningTokens: null,
          cachedTokens: null,
          totalTokens:
            (Number.isFinite(inputTokens) ? inputTokens : 0) +
            (Number.isFinite(outputTokens) ? outputTokens : 0),
          estimated: false,
          raw: json.usage,
        }
      : estimateTokensFromMessagesAndContent(messages, content);
  return {
    content,
    providerSlug: config.slug,
    providerName: config.slug,
    model: config.model,
    usage,
    latencyMs: Date.now() - startedAt,
  };
}

async function callGeminiOnce(
  config: ProviderConfig,
  messages: ChatMessage[],
  model: string
): Promise<ProviderCallResult> {
  const baseUrl =
    config.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${model}:generateContent`;
  const startedAt = Date.now();

  const system = messages.find((m) => m.role === "system")?.content || "";
  const userContent = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: system ? `${system}\n\n${userContent}` : userContent }],
        },
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatAiProviderError("gemini", res.status, err));
  }

  const json = await res.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const usage = json.usageMetadata
    ? normalizeGeminiUsage(json)
    : estimateTokensFromMessagesAndContent(messages, content);
  return {
    content,
    providerSlug: config.slug,
    providerName: config.slug,
    model,
    usage,
    latencyMs: Date.now() - startedAt,
  };
}

async function callGemini(config: ProviderConfig, messages: ChatMessage[]): Promise<ProviderCallResult> {
  const primary = normalizeGeminiModel(config.model);
  const candidates = [
    primary,
    ...GEMINI_FALLBACK_MODELS.filter((m) => m !== primary),
  ];

  let lastError: Error | null = null;
  for (const model of candidates) {
    try {
      const result = await callGeminiOnce(config, messages, model);
      if (result.content) return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNotFound =
        lastError.message.includes("404") || lastError.message.includes("NOT_FOUND");
      if (!isNotFound) throw lastError;
    }
  }

  throw lastError || new Error("Gemini: semua model fallback gagal");
}

export async function callProvider(
  provider: AiProvider,
  messages: ChatMessage[],
  modelOverride?: string | null
): Promise<string> {
  const result = await callProviderDetailed(provider, messages, modelOverride);
  return result.content;
}

export async function callProviderDetailed(
  provider: AiProvider,
  messages: ChatMessage[],
  modelOverride?: string | null,
  context?: AiUsageContext
): Promise<ProviderCallResult> {
  const config = toConfig(provider, modelOverride);

  if (!config.apiKey || isPlaceholderKey(config.apiKey)) {
    throw new Error(`Provider ${provider.slug} tidak memiliki API key valid`);
  }

  try {
    let result: ProviderCallResult;
    switch (provider.slug) {
      case "openai":
        result = await callOpenAICompatible(config, messages);
        break;
      case "openrouter":
        result = await callOpenAICompatible(config, messages, {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "Navalogi",
        });
        break;
      case "claude":
      case "anthropic":
        result = await callAnthropic(config, messages);
        break;
      case "gemini":
        result = await callGemini(config, messages);
        break;
      case "custom":
        result = await callOpenAICompatible(config, messages);
        break;
      default:
        result = await callOpenAICompatible(config, messages);
        break;
    }

    result.providerName = provider.name;
    await recordAiUsage({
      context,
      provider,
      model: result.model,
      status: "SUCCESS",
      usage: result.usage,
      latencyMs: result.latencyMs,
    });
    return result;
  } catch (err) {
    const usage = estimateTokensFromMessagesAndContent(messages);
    await recordAiUsage({
      context,
      provider,
      model: config.model,
      status: "FAILED",
      usage,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function testProviderConnection(provider: AiProvider): Promise<{
  ok: boolean;
  message: string;
  sample?: string;
}> {
  try {
    const content = await callProvider(provider, [
      { role: "system", content: "Anda asisten singkat." },
      { role: "user", content: 'Balas tepat: "OK"' },
    ]);
    if (!content) {
      return { ok: false, message: "Response kosong dari provider" };
    }
    return { ok: true, message: "Koneksi berhasil", sample: content.slice(0, 100) };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Koneksi gagal",
    };
  }
}

function demoText(value: unknown, fallback: string): string {
  const text = String(value || "").trim();
  return text || fallback;
}

function demoSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDemoPertemuan(data: Record<string, unknown>): number {
  const raw = Number(String(data.jumlahPertemuan || "1").trim());
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 6) : 1;
}

function getDemoFase(jenjangRaw: unknown, kelasRaw: unknown): string {
  const jenjang = String(jenjangRaw || "").trim().toLowerCase();
  const kelas = String(kelasRaw || "").trim();

  const faseByJenjangKelas: Record<string, Record<string, string>> = {
    sd: { "1": "A", "2": "A", "3": "B", "4": "B", "5": "C", "6": "C" },
    smp: { "7": "D", "8": "D", "9": "D" },
    sma: { "10": "E", "11": "F", "12": "F" },
    smk: { "10": "E", "11": "F", "12": "F" },
  };

  const fase = faseByJenjangKelas[jenjang]?.[kelas];
  if (fase) return `Fase ${fase}`;
  return kelas ? `Fase ${kelas}` : "Fase";
}

function buildDemoModulAjarContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Semester");
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const topik = demoText(data.topik, "Materi Pembelajaran");
  const alokasiWaktu = demoText(data.alokasiWaktu, "2 x 40 menit");
  const model = demoText(
    data.praktikPedagogis || data.modelPembelajaran,
    "Problem Based Learning (PBL)"
  );
  const cp = demoText(
    data.capaianPembelajaran,
    `Peserta didik mampu memahami, menganalisis, dan menerapkan konsep ${topik} secara kontekstual sesuai fase belajar.`
  );
  const analisisMateri = demoText(
    data.analisisMateri,
    `Materi ${topik} dipilih karena relevan dengan konteks kehidupan peserta didik, memungkinkan latihan berpikir kritis, komunikasi, dan pemecahan masalah secara bertahap.`
  );
  const kesiapan = demoText(
    data.kesiapanPesertaDidik,
    `Peserta didik telah memiliki pengalaman awal yang berkaitan dengan ${topik}, namun masih membutuhkan penguatan konsep, contoh konkret, dan latihan terstruktur.`
  );
  const dplValues = String(data.dimensiProfilLulusan || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const dpl = dplValues.length > 0
    ? dplValues
    : ["Penalaran Kritis", "Kolaborasi", "Komunikasi"];
  const pertemuan = getDemoPertemuan(data);
  const topikSlug = demoSlug(topik) || "materi";
  const fase = getDemoFase(jenjang, kelas);

  const tujuanRows = Array.from({ length: 4 }, (_, index) => {
    const no = index + 1;
    return `| ${no} | Peserta didik mampu ${
      no === 1
        ? `mengidentifikasi informasi penting terkait ${topik} (C2).`
        : no === 2
          ? `menjelaskan konsep ${topik} dengan bahasa sendiri secara runtut (C2-C3).`
          : no === 3
            ? `menerapkan konsep ${topik} pada tugas atau studi kasus sederhana (C3-C4).`
            : `menyajikan hasil analisis ${topik} secara lisan/tulisan dengan tepat (C4-P3).`
    } |`;
  }).join("\n");

  const atpRows = Array.from({ length: pertemuan }, (_, index) => {
    const no = index + 1;
    return `| ${no} | Eksplorasi konsep, latihan terbimbing, dan penguatan ${topik} pada konteks pertemuan ${no}. | TP ${Math.min(no, 4)} |`;
  }).join("\n");

  const intiPertemuan = Array.from({ length: pertemuan }, (_, index) => {
    const no = index + 1;
    return [
      `#### Pertemuan ${no}: Penerapan ${topik} ${no === 1 ? "pada konteks awal" : `tahap ${no}`}`,
      "",
      "| Langkah Model | Aktivitas Guru | Aktivitas Siswa | Waktu |",
      "| --- | --- | --- | --- |",
      `| Orientasi Masalah | Guru menyajikan situasi kontekstual tentang ${topik}. | Siswa mengamati, bertanya, dan menghubungkan dengan pengalaman awal. | 10 menit |`,
      `| Pengorganisasian | Guru membagi kelompok, menjelaskan tujuan, dan membagikan LKPD. | Siswa membaca instruksi dan membagi peran dalam kelompok. | 10 menit |`,
      `| Investigasi | Guru memandu diskusi, memberi penguatan konsep, dan memonitor proses. | Siswa menelaah sumber, berdiskusi, dan menyelesaikan tugas terkait ${topik}. | 25 menit |`,
      `| Presentasi | Guru memfasilitasi presentasi dan tanya jawab antarkelompok. | Siswa mempresentasikan hasil dan menanggapi kelompok lain. | 15 menit |`,
      `| Evaluasi | Guru memberi umpan balik dan menyimpulkan temuan penting. | Siswa merefleksi hasil belajar dan memperbaiki jawaban. | 10 menit |`,
      "",
    ].join("\n");
  }).join("\n");

  const glossaryTerms = [
    topik,
    "konsep",
    "analisis",
    "informasi",
    "argumen",
    "refleksi",
    "strategi",
    "evaluasi",
  ];

  const rawContent = [
    "### 1. Identitas Modul",
    "| Komponen | Deskripsi |",
    "| --- | --- |",
    `| Penyusun | ${namaGuru} |`,
    `| Institusi | ${sekolah} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Jenjang | ${jenjang} |`,
    `| Kelas | ${kelas} |`,
    `| Fase | ${fase} |`,
    `| Semester | ${semester} |`,
    `| Mata Pelajaran | ${mapel} |`,
    `| Topik | ${topik} |`,
    `| Alokasi Waktu | ${alokasiWaktu} |`,
    `| Model Pembelajaran | ${model} |`,
    "",
    "### 2. Kompetensi Awal",
    `${kesiapan}`,
    "",
    `- Peserta didik mengenali istilah dasar yang berkaitan dengan ${topik}.`,
    `- Peserta didik pernah menemukan contoh ${topik} pada kegiatan belajar atau kehidupan sehari-hari.`,
    "- Peserta didik memerlukan latihan membaca informasi, mengolah data, dan menyampaikan pendapat.",
    "- Peserta didik membutuhkan contoh konkret dan umpan balik bertahap agar pemahaman lebih kuat.",
    "",
    "### 3. Dimensi Profil Lulusan (DPL)",
    "| Dimensi | Implementasi dalam Pembelajaran |",
    "| --- | --- |",
    ...dpl.map(
      (item) =>
        `| ${item} | Dikembangkan melalui aktivitas analisis, diskusi, presentasi, dan refleksi pada topik ${topik}. |`
    ),
    "",
    "### 4. Sarana dan Prasarana",
    "| Jenis | Rincian |",
    "| --- | --- |",
    `| Alat | Laptop/gawai, papan tulis, alat tulis, dan perangkat presentasi untuk pembelajaran ${topik}. |`,
    `| Bahan | Bahan ajar, LKPD, lembar observasi, serta tugas terstruktur tentang ${topik}. |`,
    `| Media | ${demoText(data.media, "Slide presentasi, gambar kontekstual, dan lembar kerja.")} |`,
    `| Sumber Belajar | ${demoText(data.pemanfaatanDigital, "Buku teks, lingkungan sekitar, dan sumber digital terkurasi.")} |`,
    "",
    "### 5. Target Peserta Didik",
    "**Karakteristik umum:**",
    `- Peserta didik ${jenjang} kelas ${kelas} memiliki variasi kemampuan akademik dan minat belajar.`,
    `- Peserta didik cenderung lebih mudah memahami ${topik} jika disajikan dengan contoh kontekstual.`,
    "- Peserta didik membutuhkan arahan yang jelas serta kesempatan berdiskusi dengan teman sebaya.",
    "",
    "**Kebutuhan diferensiasi:**",
    "- Konten: variasi contoh, bacaan, dan stimulus sesuai kesiapan belajar.",
    "- Proses: bimbingan bertahap, diskusi kelompok, dan tugas bertingkat.",
    "- Produk: pilihan hasil kerja berupa presentasi, lembar analisis, atau rangkuman visual.",
    "",
    "### 6. Capaian Pembelajaran (CP)",
    cp,
    "",
    "### 7. Tujuan Pembelajaran (TP)",
    "| No | Tujuan Pembelajaran |",
    "| --- | --- |",
    tujuanRows,
    "",
    "### 8. Alur Tujuan Pembelajaran (ATP)",
    "| Pertemuan | Alur Kegiatan | TP yang Dicapai |",
    "| --- | --- | --- |",
    atpRows,
    "",
    "### 9. Pemahaman Bermakna",
    analisisMateri,
    "",
    `- ${topik} membantu peserta didik menghubungkan konsep akademik dengan situasi nyata.`,
    `- Pemahaman ${topik} melatih siswa mengambil keputusan berdasarkan alasan yang logis.`,
    `- Aktivitas pada materi ${topik} membangun sikap teliti, kolaboratif, dan reflektif.`,
    "",
    "### 10. Pertanyaan Pemantik",
    `1. Mengapa ${topik} penting dipahami dalam kehidupan sehari-hari?`,
    `2. Bagaimana cara menerapkan konsep ${topik} saat menyelesaikan masalah nyata?`,
    `3. Apa akibatnya jika konsep ${topik} digunakan tanpa pemahaman yang tepat?`,
    "",
    "### 11. Pendahuluan",
    "| Tahap | Aktivitas Guru | Aktivitas Siswa | Waktu |",
    "| --- | --- | --- | --- |",
    "| Salam dan Doa | Guru membuka pembelajaran, menyiapkan suasana belajar, dan memimpin doa. | Siswa menjawab salam, berdoa, dan menyiapkan diri. | 3 menit |",
    "| Presensi dan Ice Breaking | Guru mengecek kehadiran dan memberi ice breaking singkat. | Siswa merespons kegiatan awal dan fokus pada pembelajaran. | 5 menit |",
    `| Apersepsi | Guru mengaitkan materi sebelumnya dengan topik ${topik}. | Siswa mengingat pengalaman awal dan menyampaikan pendapat. | 7 menit |`,
    `| Motivasi | Guru menjelaskan manfaat mempelajari ${topik}. | Siswa menyimak dan menunjukkan rasa ingin tahu. | 5 menit |`,
    "| Penyampaian Tujuan | Guru menjelaskan tujuan pembelajaran dan alur kegiatan. | Siswa memahami target belajar pada pertemuan tersebut. | 5 menit |",
    "",
    "### 12. Kegiatan Inti",
    `Model pembelajaran yang digunakan adalah **${model}**.`,
    "",
    intiPertemuan,
    "**Strategi Diferensiasi**",
    "- Konten: guru menyiapkan bacaan inti dan bacaan pengayaan.",
    "- Proses: guru memberi pendampingan lebih intensif pada siswa yang masih memerlukan bantuan.",
    "- Produk: siswa dapat memilih bentuk hasil kerja berupa tabel analisis, ringkasan, atau presentasi singkat.",
    "",
    "### 13. Penutup",
    "| Tahap | Aktivitas Guru | Aktivitas Siswa | Waktu |",
    "| --- | --- | --- | --- |",
    "| Refleksi | Guru memandu refleksi pembelajaran dan menanyakan poin penting. | Siswa menyampaikan hal yang dipahami dan hal yang masih membingungkan. | 5 menit |",
    "| Asesmen Formatif | Guru memberi cek pemahaman akhir singkat. | Siswa mengerjakan tugas singkat atau menjawab pertanyaan reflektif. | 5 menit |",
    "| Tindak Lanjut | Guru menyampaikan penguatan, pengayaan, atau remedial. | Siswa mencatat tindak lanjut dan tugas rumah jika ada. | 3 menit |",
    "| Doa dan Salam | Guru menutup kegiatan pembelajaran. | Siswa berdoa dan mengucapkan salam penutup. | 2 menit |",
    "",
    "### 14. Asesmen Diagnostik",
    "| No | Pertanyaan/Teknik | Tujuan |",
    "| --- | --- | --- |",
    `| 1 | Tanya jawab awal tentang pengalaman siswa terkait ${topik}. | Mengidentifikasi pengetahuan awal. |`,
    `| 2 | Lembar cek pemahaman prasyarat ${topik}. | Memetakan kesiapan belajar. |`,
    "| 3 | Observasi respons siswa saat apersepsi. | Menentukan kebutuhan diferensiasi. |",
    "",
    "### 15. Asesmen Formatif",
    "| Aspek | Instrumen | Waktu |",
    "| --- | --- | --- |",
    "| Keaktifan diskusi | Lembar observasi | Saat kerja kelompok |",
    `| Pemahaman konsep ${topik} | Tanya jawab lisan | Saat eksplorasi konsep |`,
    "| Kolaborasi | Rubrik kerja sama | Saat kegiatan inti |",
    "| Presentasi hasil | Rubrik presentasi | Saat paparan kelompok |",
    "| Refleksi individu | Jurnal/refleksi singkat | Akhir pembelajaran |",
    "",
    "### 16. Asesmen Sumatif",
    `Asesmen sumatif dilakukan melalui tugas produk/proyek sederhana yang menuntut peserta didik menerapkan konsep ${topik} pada konteks nyata.`,
    "",
    "**Rubrik Penilaian**",
    "",
    "| Kriteria | Skor 4 | Skor 3 | Skor 2 | Skor 1 |",
    "| --- | --- | --- | --- | --- |",
    `| Ketepatan konsep ${topik} | Sangat tepat dan mendalam | Tepat dengan sedikit kekurangan | Sebagian tepat | Belum tepat |`,
    "| Kelengkapan jawaban | Sangat lengkap | Lengkap | Kurang lengkap | Sangat terbatas |",
    "| Argumentasi | Logis, runtut, dan kuat | Cukup logis | Kurang runtut | Tidak jelas |",
    "| Kolaborasi/presentasi | Sangat aktif dan komunikatif | Aktif | Cukup aktif | Pasif |",
    "| Kerapian produk | Sangat rapi dan sistematis | Rapi | Cukup rapi | Kurang rapi |",
    "",
    "**Konversi Nilai:**",
    "- A: 90-100",
    "- B: 80-89",
    "- C: 70-79",
    "- D: < 70",
    "",
    "### 17. Pengayaan dan Remedial",
    "**Kegiatan Pengayaan**",
    `- Menganalisis kasus lanjutan yang berkaitan dengan ${topik}.`,
    `- Menyusun ringkasan atau infografik tentang ${topik}.`,
    `- Mempresentasikan penerapan ${topik} di lingkungan sekitar.`,
    "",
    "**Kegiatan Remedial**",
    `- Mengulang konsep dasar ${topik} dengan contoh yang lebih sederhana.`,
    "- Mengisi LKPD bimbingan dengan langkah-langkah yang dipandu guru.",
    "- Mengikuti pembahasan ulang secara berkelompok kecil atau tutor sebaya.",
    "",
    "### 18. Refleksi Guru",
    "| Aspek | Pertanyaan Refleksi |",
    "| --- | --- |",
    `| Ketercapaian tujuan | Apakah tujuan pembelajaran ${topik} tercapai sesuai target? |`,
    "| Keterlibatan siswa | Bagaimana tingkat partisipasi siswa selama diskusi dan presentasi? |",
    "| Strategi diferensiasi | Apakah diferensiasi konten, proses, dan produk sudah membantu semua siswa? |",
    `| Media dan sumber | Media apa yang paling efektif untuk menjelaskan ${topik}? |`,
    "| Manajemen waktu | Bagian mana yang memerlukan penyesuaian durasi pada pertemuan berikutnya? |",
    "| Tindak lanjut | Perbaikan apa yang perlu dilakukan untuk pembelajaran selanjutnya? |",
    "",
    "### 19. Lembar Kerja / Bahan Ajar",
    "**LKPD 1: Eksplorasi Konsep**",
    "",
    `Instruksi: Bacalah stimulus tentang ${topik}, lalu isi tabel berikut secara berkelompok.`,
    "",
    "| Langkah | Tugas Siswa | Hasil yang Diharapkan |",
    "| --- | --- | --- |",
    `| 1 | Menuliskan informasi penting terkait ${topik}. | Daftar informasi utama. |`,
    "| 2 | Mendiskusikan temuan dengan kelompok. | Kesimpulan sementara. |",
    "| 3 | Menyampaikan hasil pada forum kelas. | Paparan singkat. |",
    "",
    "**LKPD 2: Analisis dan Rencana Tindak Lanjut**",
    "",
    `Instruksi: Analisis kasus sederhana yang berhubungan dengan ${topik}, lalu buat rencana penyelesaiannya.`,
    "",
    "| Komponen | Jawaban Siswa |",
    "| --- | --- |",
    `| Permasalahan | Uraian masalah terkait ${topik}. |`,
    "| Analisis | Hasil analisis berdasarkan konsep yang dipelajari. |",
    "| Solusi/Rencana | Langkah tindak lanjut atau solusi yang diusulkan. |",
    "",
    "### 20. Glosarium",
    "| Istilah | Arti |",
    "| --- | --- |",
    ...glossaryTerms.map((term, index) => {
      const label = term === topik ? topik : term.charAt(0).toUpperCase() + term.slice(1);
      return `| ${label} | Istilah kunci ${index === 0 ? `yang berkaitan langsung dengan ${topikSlug}.` : "dalam pembelajaran yang perlu dipahami siswa."} |`;
    }),
    "",
    "### 21. Daftar Pustaka",
    `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi. Capaian Pembelajaran ${mapel} ${jenjang}.`,
    `2. Buku teks ${mapel} untuk kelas ${kelas} yang berlaku di satuan pendidikan.`,
    `3. Sumber belajar kontekstual dan referensi digital terkurasi terkait ${topik}.`,
  ].join("\n");

  return `${composeModulAjarMarkdown(rawContent, data)}\n\n> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.`;
}

function buildDemoProtaContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const nip = demoText(data.nip, "-");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const fase = getDemoFase(jenjang, kelas);
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const alokasiWaktu = demoText(data.alokasiWaktu, "3 JP per minggu (1 JP = 45 menit)");
  const cp = demoText(
    data.capaianPembelajaran,
    `Pada tahun ajaran ${tahunAjaran}, peserta didik ${kelas} ${mapel} diharapkan mampu memahami, menganalisis, dan memproduksi teks sesuai fase belajar, serta menunjukkan keterampilan berpikir kritis, kreatif, kolaboratif, dan komunikatif dalam konteks pembelajaran Indonesia.`
  );

  const rawContent = [
    "# Program Tahunan (Prota)",
    "",
    "## Identitas",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Satuan Pendidikan | ${sekolah} |`,
    `| Mata Pelajaran | ${mapel} |`,
    `| Kelas | ${kelas} |`,
    `| Fase | ${fase} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Guru Pengampu | ${namaGuru} |`,
    `| NIP | ${nip} |`,
    "",
    `## Capaian Pembelajaran (CP) ${fase}`,
    cp,
    "",
    "## Analisis Alokasi Waktu - Semester 1 (Ganjil)",
    "| Bulan | Minggu Efektif | Keterangan |",
    "| --- | --- | --- |",
    "| Juli | 2 | Awal semester, MPLS, dan orientasi pembelajaran |",
    "| Agustus | 4 | Efektif penuh |",
    "| September | 4 | Efektif penuh |",
    "| Oktober | 4 | Efektif penuh |",
    "| November | 4 | Efektif penuh |",
    "| Desember | 2 | PAS, refleksi, dan libur semester |",
    "| **Total** | **20** |  |",
    "",
    `**Rincian Jam Pelajaran (JP):** ${alokasiWaktu}.`,
    "",
    "| Bulan | JP per Bulan |",
    "| --- | --- |",
    "| Juli | 6 JP |",
    "| Agustus | 12 JP |",
    "| September | 12 JP |",
    "| Oktober | 12 JP |",
    "| November | 12 JP |",
    "| Desember | 6 JP |",
    "| **Total** | **60 JP** |",
    "",
    "## Analisis Alokasi Waktu - Semester 2 (Genap)",
    "| Bulan | Minggu Efektif | Keterangan |",
    "| --- | --- | --- |",
    "| Januari | 3 | Awal semester dan penyesuaian jadwal |",
    "| Februari | 4 | Efektif penuh |",
    "| Maret | 4 | Efektif penuh |",
    "| April | 3 | Libur keagamaan dan kegiatan sekolah |",
    "| Mei | 4 | Efektif penuh |",
    "| Juni | 2 | PAT, refleksi, dan penutupan tahun ajaran |",
    "| **Total** | **20** |  |",
    "",
    `**Rincian Jam Pelajaran (JP):** ${alokasiWaktu}.`,
    "",
    "| Bulan | JP per Bulan |",
    "| --- | --- |",
    "| Januari | 9 JP |",
    "| Februari | 12 JP |",
    "| Maret | 12 JP |",
    "| April | 9 JP |",
    "| Mei | 12 JP |",
    "| Juni | 6 JP |",
    "| **Total** | **60 JP** |",
    "",
    "## Program Tahunan - Semester 1 (Ganjil)",
    "| No | Tujuan Pembelajaran | Materi Pokok | Alokasi Waktu (JP) | Bulan Pelaksanaan | Keterangan |",
    "| --- | --- | --- | --- | --- | --- |",
    `| 1 | Peserta didik mampu memahami dan menggunakan ungkapan dasar komunikasi dalam ${mapel}. | Orientasi materi awal, sapaan, pengenalan konsep dasar | 9 JP | Juli-Agustus | Pendekatan pembelajaran mendalam, diskusi, dan latihan kontekstual |`,
    `| 2 | Peserta didik mampu menganalisis informasi utama dan detail pada materi ${mapel}. | Pemahaman teks/konsep inti semester ganjil | 15 JP | Agustus-September | Penguatan literasi, diferensiasi, dan tugas kolaboratif |`,
    `| 3 | Peserta didik mampu memproduksi karya/tugas sederhana sesuai topik ${mapel}. | Produksi tugas, presentasi, dan praktik | 18 JP | Oktober-November | Integrasi proyek mini, umpan balik formatif, dan presentasi |`,
    `| 4 | Peserta didik mampu melakukan refleksi dan evaluasi hasil belajar. | Review, asesmen sumatif, penguatan | 18 JP | November-Desember | Kuis, portofolio, refleksi, dan remedial/pengayaan |`,
    "",
    "## Program Tahunan - Semester 2 (Genap)",
    "| No | Tujuan Pembelajaran | Materi Pokok | Alokasi Waktu (JP) | Bulan Pelaksanaan | Keterangan |",
    "| --- | --- | --- | --- | --- | --- |",
    `| 1 | Peserta didik mampu memperdalam konsep dan strategi penerapan ${mapel} pada konteks nyata. | Penguatan konsep lanjutan semester genap | 12 JP | Januari-Februari | Studi kasus, diskusi, dan pembelajaran berbasis masalah |`,
    `| 2 | Peserta didik mampu menghasilkan produk/solusi berdasarkan pemahaman ${mapel}. | Karya terapan, proyek, dan unjuk kerja | 18 JP | Februari-Maret | Proyek kolaboratif, presentasi, dan asesmen autentik |`,
    `| 3 | Peserta didik mampu mengevaluasi hasil kerja dan memperbaiki kualitas produk belajar. | Review, asesmen, dan penguatan | 15 JP | April-Mei | Diferensiasi, remedial, pengayaan, dan umpan balik |`,
    `| 4 | Peserta didik mampu menutup pembelajaran tahunan dengan portofolio dan refleksi. | Portofolio akhir dan evaluasi | 15 JP | Mei-Juni | Integrasi asesmen sumatif dan refleksi akhir tahun |`,
    "",
    "## Catatan dan Rekomendasi",
    "1. Pendekatan pembelajaran mendalam diterapkan melalui kegiatan yang sadar, bermakna, dan menyenangkan.",
    "2. Asesmen dilaksanakan secara formatif dan sumatif dengan prinsip fleksibel sesuai kalender sekolah.",
    "3. Alokasi waktu dapat disesuaikan dengan kondisi nyata sekolah, kegiatan P5, dan agenda satuan pendidikan.",
    "4. Integrasi teknologi, diferensiasi, dan konteks dunia nyata dianjurkan pada setiap topik utama.",
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ];

  return rawContent.join("\n");
}

function buildDemoProsemContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const nip = demoText(data.nip, "-");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Ganjil");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const fase = getDemoFase(jenjang, kelas);
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const alokasiWaktu = demoText(data.alokasiWaktu, "2 JP per minggu (1 JP = 45 menit)");
  const isGanjil = semester.toLowerCase().includes("ganjil");
  const bulanCols = isGanjil
    ? ["Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    : ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun"];
  const cp = demoText(
    data.capaianPembelajaran,
    `Pada akhir semester ${semester}, peserta didik mampu memahami, menganalisis, dan menyajikan konsep ${mapel} secara lisan maupun tulisan sesuai konteks pembelajaran dan fase ${fase}.`
  );

  const distribusiRows = [
    {
      tp: `Memahami konsep dasar ${mapel} dan mengaitkannya dengan konteks awal semester.`,
      jp: 8,
      months: isGanjil ? ["4", "4", "", "", "", ""] : ["4", "4", "", "", "", ""],
      ket: "TP awal semester",
    },
    {
      tp: `Menganalisis materi inti ${mapel} dan mempresentasikan hasil diskusi.`,
      jp: 8,
      months: isGanjil ? ["", "4", "4", "", "", ""] : ["", "4", "4", "", "", ""],
      ket: "TP penguatan",
    },
    {
      tp: `Menghasilkan tugas/produk sederhana berbasis ${mapel}.`,
      jp: 10,
      months: isGanjil ? ["", "", "2", "4", "4", ""] : ["", "", "2", "4", "4", ""],
      ket: "TP proyek/unjuk kerja",
    },
    {
      tp: `Melakukan refleksi, remedial, dan asesmen sumatif semester ${semester}.`,
      jp: 6,
      months: isGanjil ? ["", "", "", "", "2", "4"] : ["", "", "", "", "2", "4"],
      ket: "TP penutup semester",
    },
  ];

  const rawContent = [
    "# Program Semester (Prosem)",
    "",
    "## Identitas",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Mata Pelajaran | ${mapel} |`,
    `| Kelas / Semester | ${kelas} / ${semester} |`,
    `| Fase | ${fase} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Nama Sekolah | ${sekolah} |`,
    `| Nama Guru | ${namaGuru} |`,
    `| NIP | ${nip} |`,
    "",
    "## Capaian Pembelajaran (CP)",
    cp,
    "",
    `**CP Spesifik Semester ${semester}:**`,
    `1. Peserta didik mampu memahami materi inti ${mapel} secara bertahap sesuai urutan semester.`,
    `2. Peserta didik mampu menganalisis konsep, contoh, dan penerapan ${mapel} dalam konteks nyata.`,
    "3. Peserta didik mampu bekerja sama, berdiskusi, dan menyampaikan hasil belajar secara runtut.",
    "4. Peserta didik mampu merefleksi hasil belajar dan memperbaiki kualitas tugas atau produk.",
    "",
    `## Analisis Minggu Efektif - ${semester} (${isGanjil ? "Semester 1" : "Semester 2"})`,
    "| No | Bulan | Jumlah Minggu | Minggu Tidak Efektif | Minggu Efektif | Keterangan |",
    "| --- | --- | --- | --- | --- | --- |",
    isGanjil
      ? "| 1 | Juli | 4 | 1 | 3 | Libur akhir tahun ajaran dan MPLS |"
      : "| 1 | Januari | 4 | 1 | 3 | Awal semester dan penyesuaian jadwal |",
    isGanjil
      ? "| 2 | Agustus | 4 | 0 | 4 | Kegiatan belajar mengajar |"
      : "| 2 | Februari | 4 | 0 | 4 | Kegiatan belajar mengajar |",
    isGanjil
      ? "| 3 | September | 4 | 0 | 4 | Kegiatan belajar mengajar |"
      : "| 3 | Maret | 4 | 0 | 4 | Kegiatan belajar mengajar |",
    isGanjil
      ? "| 4 | Oktober | 4 | 0 | 4 | Kegiatan belajar mengajar |"
      : "| 4 | April | 4 | 1 | 3 | Libur keagamaan dan agenda sekolah |",
    isGanjil
      ? "| 5 | November | 4 | 1 | 3 | Sumatif tengah/asesmen berkala |"
      : "| 5 | Mei | 4 | 0 | 4 | Kegiatan belajar mengajar |",
    isGanjil
      ? "| 6 | Desember | 3 | 1 | 2 | PAS, refleksi, dan libur semester |"
      : "| 6 | Juni | 3 | 1 | 2 | PAT, refleksi, dan penutupan tahun ajaran |",
    "| **Total** |  | **23** | **3** | **20** |  |",
    "",
    `- **Rincian JP:** ${alokasiWaktu}.`,
    "- **Total JP tersedia:** 20 minggu efektif x alokasi per minggu, disesuaikan dengan kebutuhan TP.",
    "",
    `## Distribusi Alokasi Waktu (${distribusiRows.length} TP)`,
    `| No | Tujuan Pembelajaran | JP | ${bulanCols.join(" | ")} | Ket |`,
    `| --- | --- | --- | ${bulanCols.map(() => "---").join(" | ")} | --- |`,
    ...distribusiRows.map((row, index) =>
      `| ${index + 1} | ${row.tp} | ${row.jp} | ${row.months.join(" | ")} | ${row.ket} |`
    ),
    "",
    "## Jadwal Asesmen",
    "| No | Jenis | Materi/TP | Minggu | Bulan | Bentuk |",
    "| --- | --- | --- | --- | --- | --- |",
    `| 1 | Formatif 1 | TP 1 | Minggu ke-4 | ${isGanjil ? "Agustus" : "Februari"} | Observasi, kuis, dan diskusi |`,
    `| 2 | Formatif 2 | TP 2 | Minggu ke-8 | ${isGanjil ? "September" : "Maret"} | Penugasan dan presentasi |`,
    `| 3 | Sumatif Tengah | TP 1-2 | Minggu ke-12 | ${isGanjil ? "Oktober" : "April"} | Tes tertulis dan proyek mini |`,
    `| 4 | Formatif 3 | TP 3 | Minggu ke-16 | ${isGanjil ? "November" : "Mei"} | Unjuk kerja dan portofolio |`,
    `| 5 | Sumatif Akhir | TP 1-4 | Minggu ke-20 | ${isGanjil ? "Desember" : "Juni"} | Tes tertulis, presentasi, dan refleksi |`,
    "",
    "## Rencana Kegiatan P5",
    "| Tema P5 | Dimensi | Alokasi | Bulan | Keterangan |",
    "| --- | --- | --- | --- | --- |",
    `| Kearifan Lokal | Berkebinekaan global, Kreatif, Gotong royong | 8 JP (di luar JP reguler) | ${isGanjil ? "Oktober-November" : "Maret-April"} | Peserta didik menyusun produk kolaboratif yang mengaitkan ${mapel} dengan konteks lokal sekolah. |`,
    `| Suara Demokrasi | Bernalar kritis, Mandiri, Komunikasi | 6 JP (di luar JP reguler) | ${isGanjil ? "November-Desember" : "Mei-Juni"} | Peserta didik membuat kampanye, presentasi, atau karya sederhana yang relevan dengan tema sekolah. |`,
    "",
    "## Catatan",
    "1. Distribusi alokasi waktu dapat disesuaikan dengan kalender pendidikan dan kegiatan sekolah setempat.",
    "2. Asesmen dilaksanakan secara bertahap dan mencakup aspek kognitif, afektif, serta psikomotorik.",
    "3. Kegiatan P5 bersifat fleksibel dan dapat diintegrasikan dengan proyek lintas mata pelajaran.",
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ];

  return rawContent.join("\n");
}

function buildDemoLkpdContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Ganjil (Semester 1)");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const fase = getDemoFase(jenjang, kelas);
  const topik = demoText(data.topik, "Topik Pembelajaran");
  const tujuan = demoText(
    data.tujuan,
    `Peserta didik mampu memahami ${topik}, menyajikan hasil pengamatan, dan menyusun respons/tugas sederhana sesuai konteks pembelajaran.`
  );
  const cp = demoText(
    data.capaianPembelajaran,
    `Peserta didik mampu memahami, menganalisis, dan mengomunikasikan konsep ${topik} sesuai konteks ${mapel} pada fase ${fase}.`
  );
  const model = demoText(data.modelPembelajaran, "Problem Based Learning (PBL)");
  const media = demoText(
    data.media,
    "LKPD cetak, kartu kosakata/konsep, buku teks, gambar stimulus, dan alat tulis."
  );

  const rawContent = [
    "# LEMBAR KERJA PESERTA DIDIK (LKPD)",
    "",
    "## HEADER LKPD",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Judul LKPD | ${topik} |`,
    `| Mata Pelajaran | ${mapel} |`,
    `| Kelas/Semester | ${kelas} / ${semester} |`,
    `| Fase | ${fase} |`,
    "| Nama Siswa | ________________________ |",
    "| No. Absen | ________________________ |",
    "| Tanggal | ________________________ |",
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Nama Sekolah | ${sekolah} |`,
    `| Guru Pengampu | ${namaGuru} |`,
    "",
    "## KOMPETENSI & TUJUAN PEMBELAJARAN",
    "### Capaian Pembelajaran (CP)",
    cp,
    "",
    "### Tujuan Pembelajaran (TP) - Format ABCD",
    "| Audience | Behavior | Condition | Degree |",
    "| --- | --- | --- | --- |",
    `| Peserta didik kelas ${kelas} | mampu menjelaskan dan menerapkan ${topik} | melalui kegiatan ${model}, diskusi, dan latihan pada LKPD | dengan ketepatan minimal 80% |`,
    `| Peserta didik kelas ${kelas} | mampu menyusun jawaban/tugas terkait ${topik} | menggunakan informasi dari ringkasan materi dan contoh | secara runtut dan sesuai instruksi |`,
    "",
    `**Tujuan Kegiatan:** ${tujuan}`,
    "",
    "## PETUNJUK PENGERJAAN",
    "1. Baca identitas LKPD dan tuliskan data dirimu secara lengkap.",
    `2. Pelajari ringkasan materi tentang ${topik} sebelum mengerjakan tugas.`,
    "3. Kerjakan setiap tugas secara runtut, jujur, dan rapi.",
    "4. Diskusikan dengan teman atau guru jika ada instruksi yang belum dipahami.",
    "5. Tulis kesimpulan dan refleksi diri setelah semua kegiatan selesai.",
    "",
    "## RINGKASAN MATERI / DASAR TEORI",
    `### Konsep Inti ${topik}`,
    `Materi ${topik} membantu peserta didik memahami konsep utama ${mapel} melalui contoh yang dekat dengan kehidupan sehari-hari dan konteks pembelajaran di kelas.`,
    "",
    "### Struktur / Langkah Penting",
    `- Identifikasi informasi penting terkait ${topik}.`,
    `- Analisis contoh atau kasus sederhana terkait ${topik}.`,
    `- Susun jawaban, dialog, tabel, atau produk sederhana berdasarkan pemahaman ${topik}.`,
    "",
    "### Bahasa / Unsur Pendukung",
    `Peserta didik memperhatikan ketepatan istilah, struktur jawaban, dan kesesuaian konteks pada setiap tugas ${topik}.`,
    "",
    "## ALAT DAN BAHAN",
    "| Jenis | Rincian |",
    "| --- | --- |",
    `| Media/Alat | ${media} |`,
    "| Bahan | Buku catatan, lembar tugas, dan sumber belajar pendukung |",
    "| Penunjang | Kamus mini, internet terarah, atau contoh dari guru |",
    "",
    "## KEGIATAN PEMBELAJARAN",
    `### Kegiatan 1: Mengamati / Eksplorasi (10 menit)`,
    `Siswa mengamati stimulus awal tentang ${topik}, lalu menuliskan informasi penting yang ditemukan.`,
    "",
    `### Kegiatan 2: Mengumpulkan Informasi (25 menit)`,
    `Siswa membaca ringkasan materi, berdiskusi, dan mencatat konsep penting terkait ${topik}.`,
    "",
    `### Kegiatan 3: Mengolah & Menganalisis (15 menit)`,
    "Siswa menjawab pertanyaan analisis, menyusun jawaban, dan membandingkan hasil dengan teman kelompok.",
    "",
    `### Kegiatan 4: Menyimpulkan (10 menit)`,
    `Siswa menyusun kesimpulan tentang ${topik} dan menyiapkan refleksi diri.`,
    "",
    "## PERTANYAAN / TUGAS",
    "### Soal 1: Isian Singkat (10 poin)",
    `Tuliskan 3 informasi penting yang kamu temukan tentang ${topik}.`,
    "",
    "| No | Jawaban |",
    "| --- | --- |",
    "| 1 | ________________________________ |",
    "| 2 | ________________________________ |",
    "| 3 | ________________________________ |",
    "",
    "### Soal 2: Uraian (20 poin)",
    `Jelaskan dengan bahasamu sendiri mengapa ${topik} penting dipahami dalam pembelajaran ${mapel}.`,
    "",
    "| Ruang Jawaban |",
    "| --- |",
    "| ________________________________________ |",
    "| ________________________________________ |",
    "| ________________________________________ |",
    "",
    "### Soal 3: Tugas Produk / Praktik (30 poin)",
    `Susun hasil kerja sederhana yang menunjukkan penerapan ${topik}, lalu presentasikan secara singkat di depan kelas atau kelompok.`,
    "",
    "| Langkah | Hasil Kerja |",
    "| --- | --- |",
    "| Perencanaan | ________________________________ |",
    "| Pelaksanaan | ________________________________ |",
    "| Hasil Akhir | ________________________________ |",
    "",
    "### Soal 4: Analisis / Refleksi Tugas (20 poin)",
    `Apa kendala yang kamu temukan saat mengerjakan tugas ${topik}, dan bagaimana cara mengatasinya?`,
    "",
    "| Ruang Jawaban |",
    "| --- |",
    "| ________________________________________ |",
    "| ________________________________________ |",
    "",
    "## KESIMPULAN & REFLEKSI",
    "### Kesimpulan Siswa",
    "Tuliskan 3 hal penting yang kamu pelajari hari ini.",
    "",
    "1. ________________________________________",
    "2. ________________________________________",
    "3. ________________________________________",
    "",
    "### Refleksi Diri",
    "1. Apa bagian paling mudah dari pembelajaran hari ini? Mengapa?",
    "2. Apa bagian paling menantang? Apa strategi yang akan kamu lakukan untuk memperbaikinya?",
    "3. Bagaimana perasaanmu setelah menyelesaikan LKPD ini?",
    "",
    "## RUBRIK PENILAIAN",
    "### A. Penilaian Isi dan Ketepatan Jawaban",
    "| Aspek | Sangat Baik (4) | Baik (3) | Cukup (2) | Perlu Bimbingan (1) |",
    "| --- | --- | --- | --- | --- |",
    "| Kesesuaian isi | Semua jawaban sesuai topik dan sangat lengkap | Sebagian besar jawaban sesuai topik | Jawaban cukup sesuai namun belum lengkap | Jawaban belum sesuai topik |",
    "| Ketepatan konsep | Menunjukkan pemahaman konsep yang tepat dan runtut | Pemahaman cukup tepat dengan sedikit kekurangan | Pemahaman masih sebagian | Pemahaman belum tepat |",
    "| Kerapian penyajian | Sangat rapi, sistematis, dan mudah dibaca | Rapi dan cukup sistematis | Kurang rapi | Tidak rapi |",
    "",
    "### B. Penilaian Produk / Praktik",
    "| Aspek | Sangat Baik (4) | Baik (3) | Cukup (2) | Perlu Bimbingan (1) |",
    "| --- | --- | --- | --- | --- |",
    "| Kelancaran penyampaian | Lancar, percaya diri, dan komunikatif | Cukup lancar | Kurang lancar | Masih sangat terbata-bata |",
    "| Kerja sama / kemandirian | Sangat aktif dan bertanggung jawab | Aktif | Cukup aktif | Pasif atau belum mandiri |",
    "| Kualitas hasil kerja | Produk sangat sesuai instruksi dan kreatif | Produk sesuai instruksi | Produk cukup sesuai | Produk belum sesuai |",
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ];

  return rawContent.join("\n");
}

function buildDemoRubrikContent(data: Record<string, unknown>): string {
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Ganjil");
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const topik = demoText(data.topik, "Tugas/Topik");
  const jenisPenilaian = demoText(data.jenisPenilaian, "Presentasi");
  const jenisAsesmen = demoText(data.jenisAsesmen, "Asesmen Sumatif");
  const teknikPenilaian = demoText(data.teknikPenilaian, "Kinerja / Praktik");
  const kurikulum = demoText(data.kurikulum, "Kurikulum Merdeka");
  const aspekInput = String(data.aspek || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const aspek = aspekInput.length > 0
    ? aspekInput.slice(0, 5)
    : ["Ketepatan Isi", "Struktur Penyajian", "Penggunaan Bahasa", "Kepercayaan Diri", "Kerapian/Kualitas Produk"];

  const rubricRows = aspek.map((item) => {
    const lower = item.toLowerCase();
    const descriptor =
      lower.includes("bahasa")
        ? [
            "Penggunaan bahasa sangat tepat, lancar, dan sesuai konteks",
            "Bahasa cukup tepat dengan sedikit kekeliruan",
            "Bahasa masih kurang konsisten dan beberapa bagian kurang tepat",
            "Bahasa belum tepat dan mengganggu pemahaman",
          ]
        : lower.includes("percaya") || lower.includes("presentasi")
          ? [
              "Sangat percaya diri, kontak mata baik, dan penyampaian meyakinkan",
              "Cukup percaya diri dan penyampaian cukup jelas",
              "Kurang percaya diri, penyampaian belum stabil",
              "Belum percaya diri dan penyampaian sangat terbatas",
            ]
          : lower.includes("rapi") || lower.includes("produk")
            ? [
                "Hasil kerja sangat rapi, lengkap, dan menarik",
                "Hasil kerja rapi dan cukup lengkap",
                "Hasil kerja cukup rapi namun belum lengkap",
                "Hasil kerja belum rapi dan belum sesuai",
              ]
            : [
                `Sangat tepat, lengkap, dan menunjukkan penguasaan ${topik}`,
                `Tepat dan cukup lengkap pada tugas ${topik}`,
                `Cukup tepat namun masih ada kekurangan pada ${topik}`,
                `Belum menunjukkan penguasaan ${topik} secara memadai`,
              ];

    return `| ${item} | ${descriptor[0]} | ${descriptor[1]} | ${descriptor[2]} | ${descriptor[3]} |`;
  });

  const bobotPerAspek = Math.max(10, Math.floor(100 / aspek.length));

  const rawContent = [
    `# Rubrik Penilaian: ${topik} - ${mapel}`,
    "",
    "## Identitas",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Mata Pelajaran | ${mapel} |`,
    `| Jenjang | ${jenjang.toUpperCase()} |`,
    `| Jenis Asesmen | ${jenisAsesmen} |`,
    `| Teknik Penilaian | ${teknikPenilaian} |`,
    `| Tugas | ${topik} |`,
    `| Kurikulum | ${kurikulum} |`,
    `| Kelas/Semester | ${kelas} / ${semester} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Jenis Penilaian | ${jenisPenilaian} |`,
    "",
    "## Tabel Rubrik (4 Level)",
    "| Aspek | Sangat Baik (4) | Baik (3) | Cukup (2) | Perlu Bimbingan (1) |",
    "| --- | --- | --- | --- | --- |",
    ...rubricRows,
    "",
    "## Pedoman Penskoran",
    `- Jumlah aspek yang dinilai: ${aspek.length} aspek.`,
    `- Bobot tiap aspek: ${bobotPerAspek}% atau dapat disesuaikan menurut prioritas tugas.`,
    "- Skor tiap aspek: level 4 = 4 poin, level 3 = 3 poin, level 2 = 2 poin, level 1 = 1 poin.",
    `- Rumus nilai akhir: (total skor diperoleh / ${aspek.length * 4}) x 100.`,
    "- Konversi predikat: A = 90-100, B = 80-89, C = 70-79, D = < 70.",
    "",
    "## Lembar Penilaian",
    "| No | Nama Siswa | Skor per Aspek | Total Skor | Nilai Akhir | Catatan Singkat |",
    "| --- | --- | --- | --- | --- | --- |",
    "| 1 | __________________ | __________________ | ______ | ______ | __________________ |",
    "| 2 | __________________ | __________________ | ______ | ______ | __________________ |",
    "| 3 | __________________ | __________________ | ______ | ______ | __________________ |",
    "",
    "## Catatan Guru",
    "- Catat kekuatan utama siswa pada tugas/performa yang dinilai.",
    "- Catat kesalahan atau hambatan yang paling sering muncul.",
    "- Catat kebutuhan penguatan lanjutan untuk pembelajaran berikutnya.",
    "",
    "## Hal yang Perlu Diperhatikan Saat Menilai",
    "1. Amati proses dan hasil akhir secara seimbang, bukan hanya tampilan akhir.",
    "2. Gunakan indikator perilaku atau bukti kerja yang konkret saat memberi skor.",
    "3. Berikan skor yang konsisten antar siswa berdasarkan deskriptor yang sama.",
    "",
    "## Tips Umpan Balik untuk Siswa",
    "1. Mulai dari kekuatan siswa sebelum menyampaikan area yang perlu diperbaiki.",
    `2. Hubungkan umpan balik langsung dengan aspek rubrik pada tugas ${topik}.`,
    "3. Berikan saran perbaikan yang spesifik dan dapat dilakukan pada tugas berikutnya.",
    "",
    "## Strategi Tindak Lanjut",
    "- Siswa dengan nilai tinggi diberi pengayaan atau tugas lanjutan yang lebih menantang.",
    "- Siswa yang belum mencapai target diberi latihan terbimbing, contoh tambahan, dan remedial.",
    "- Guru meninjau ulang instruksi, model contoh, atau strategi pembelajaran jika banyak siswa mengalami kesulitan serupa.",
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ];

  return rawContent.join("\n");
}

function buildDemoSilabusContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Ganjil (Semester 1)");
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const fase = getDemoFase(jenjang, kelas);
  const alokasiWaktu = demoText(data.alokasiWaktu, "72 JP / semester");
  const kurikulum = demoText(data.kurikulum, "Kurikulum Merdeka");
  const cp = demoText(
    data.capaianPembelajaran,
    `Pada akhir semester ${semester}, peserta didik mampu memahami, menganalisis, dan memproduksi materi ${mapel} sesuai konteks pembelajaran dan tuntutan fase ${fase}.`
  );
  const media = demoText(
    data.media,
    "Buku teks, video pembelajaran, presentasi digital, LKPD, proyektor, dan platform belajar daring."
  );
  const strategiAsesmen = demoText(
    data.strategiAsesmen,
    "Asesmen diagnostik dilakukan di awal semester, asesmen formatif dilakukan selama proses pembelajaran, dan asesmen sumatif dilakukan pada tengah dan akhir semester."
  );
  const dplValues = String(data.dimensiProfilLulusan || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const dimensi = dplValues.length > 0
    ? dplValues
    : ["Bernalar Kritis", "Kreativitas", "Kolaborasi", "Komunikasi"];

  const atpRows = [
    {
      minggu: "1-2",
      tp: `Peserta didik mampu mengidentifikasi konsep dasar ${mapel} dan menghubungkannya dengan konteks awal semester.`,
      materi: `Pengantar ${mapel}, konsep inti, dan orientasi materi semester.`,
      kegiatan: "Eksplorasi stimulus, diskusi awal, mencatat konsep penting, dan latihan terbimbing.",
      asesmen: "Diagnostik awal, observasi, dan tanya jawab.",
      alokasi: "8 JP",
      sumber: "Buku teks, presentasi guru, dan LKPD awal.",
    },
    {
      minggu: "3-5",
      tp: `Peserta didik mampu menganalisis materi pokok ${mapel} dan menjelaskan hasilnya secara runtut.`,
      materi: "Materi inti unit 1 dan unit 2.",
      kegiatan: "Diskusi kelompok, analisis contoh, latihan mandiri, dan presentasi singkat.",
      asesmen: "Formatif: kuis, penugasan, dan rubrik diskusi.",
      alokasi: "12 JP",
      sumber: "Buku teks, video pembelajaran, dan sumber digital terpilih.",
    },
    {
      minggu: "6-9",
      tp: `Peserta didik mampu menerapkan konsep ${mapel} pada tugas atau studi kasus sederhana.`,
      materi: "Aplikasi konsep pada konteks nyata atau proyek mini.",
      kegiatan: "Pembelajaran berbasis masalah/proyek, latihan terstruktur, dan refleksi.",
      asesmen: "Formatif dan sumatif tengah semester.",
      alokasi: "18 JP",
      sumber: "LKPD, lingkungan sekitar, internet terarah, dan contoh tugas.",
    },
    {
      minggu: "10-13",
      tp: `Peserta didik mampu menghasilkan produk atau performa yang menunjukkan penguasaan ${mapel}.`,
      materi: "Pendalaman materi lanjutan dan integrasi lintas konteks.",
      kegiatan: "Unjuk kerja, proyek kelompok, presentasi, dan umpan balik sejawat.",
      asesmen: "Formatif: observasi, produk, dan presentasi.",
      alokasi: "18 JP",
      sumber: "Rubrik, bahan ajar guru, media digital, dan aplikasi pendukung.",
    },
    {
      minggu: "14-16",
      tp: `Peserta didik mampu merefleksi hasil belajar dan menyelesaikan asesmen akhir semester dengan baik.`,
      materi: "Review, penguatan, remedial, pengayaan, dan portofolio.",
      kegiatan: "Refleksi, latihan penguatan, asesmen akhir, dan tindak lanjut.",
      asesmen: "Sumatif akhir semester dan portofolio.",
      alokasi: "16 JP",
      sumber: "Bank soal, portofolio, catatan siswa, dan bahan remedial/pengayaan.",
    },
  ];

  const profilRows = dimensi.map((item) => {
    const lower = item.toLowerCase();
    const desc = lower.includes("kritis")
      ? "Menganalisis informasi, membuat alasan, dan menarik kesimpulan logis."
      : lower.includes("kreat")
        ? "Menghasilkan ide, karya, atau solusi baru yang relevan."
        : lower.includes("kolabor")
          ? "Bekerja sama secara efektif dalam kelompok."
          : "Menyampaikan gagasan dan hasil belajar secara jelas.";
    const impl = lower.includes("kritis")
      ? `Dikembangkan melalui analisis materi ${mapel}, diskusi, dan pemecahan masalah.`
      : lower.includes("kreat")
        ? "Dikembangkan melalui tugas proyek, presentasi, atau produk pembelajaran."
        : lower.includes("kolabor")
          ? "Dikembangkan melalui kerja kelompok, diskusi kelas, dan penilaian teman sejawat."
          : "Dikembangkan melalui presentasi, refleksi, dan komunikasi lisan/tulis.";
    return `| ${item} | ${desc} | ${impl} |`;
  });

  const rawContent = [
    "# Silabus Pembelajaran",
    `## ${mapel} - Kelas ${kelas} ${semester}`,
    "",
    "### Identitas",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Mata Pelajaran | ${mapel} |`,
    `| Kelas / Semester | ${kelas} / ${semester} |`,
    `| Fase | ${fase} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Alokasi Waktu | ${alokasiWaktu} |`,
    `| Kurikulum | ${kurikulum} |`,
    `| Nama Sekolah | ${sekolah} |`,
    `| Guru Pengampu | ${namaGuru} |`,
    "",
    "### Capaian Pembelajaran (CP)",
    cp,
    "",
    "### Alur Tujuan Pembelajaran (ATP)",
    "| Minggu | Tujuan Pembelajaran | Materi Pokok | Kegiatan Pembelajaran | Asesmen | Alokasi Waktu | Sumber Belajar |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...atpRows.map(
      (row) =>
        `| ${row.minggu} | ${row.tp} | ${row.materi} | ${row.kegiatan} | ${row.asesmen} | ${row.alokasi} | ${row.sumber} |`
    ),
    "",
    "### Profil Pelajar Pancasila",
    "| Dimensi | Deskripsi | Implementasi dalam Pembelajaran |",
    "| --- | --- | --- |",
    ...profilRows,
    "",
    "### Strategi & Rencana Asesmen",
    "| Jenis Asesmen | Teknik | Waktu Pelaksanaan | Bobot |",
    "| --- | --- | --- | --- |",
    "| Diagnostik | Pretest, observasi awal, tanya jawab | Awal semester (minggu 1) | - |",
    "| Formatif | Kuis, observasi, penugasan, presentasi, refleksi | Selama proses pembelajaran | 40% |",
    "| Sumatif Tengah | Tes tertulis dan/atau praktik | Tengah semester | 25% |",
    "| Sumatif Akhir | Tes tertulis, proyek, portofolio | Akhir semester | 35% |",
    "",
    `**Catatan strategi asesmen:** ${strategiAsesmen}`,
    "",
    "### Sumber Belajar dan Media",
    "**Buku Teks dan Pendamping:**",
    `- Buku teks ${mapel} yang berlaku di sekolah.`,
    `- Modul, LKPD, dan bahan ajar guru untuk ${mapel}.`,
    "",
    "**Media dan Teknologi Pembelajaran:**",
    `- ${media}`,
    "",
    "**Sumber Digital:**",
    "- Platform pembelajaran daring sekolah atau LMS.",
    "- Video pembelajaran, artikel edukatif, dan sumber digital terarah.",
    "",
    "### Catatan",
    `- Silabus ini disusun untuk ${semester} tahun ajaran ${tahunAjaran} dan dapat disesuaikan dengan kalender pendidikan sekolah.`,
    "- Distribusi ATP, asesmen, dan alokasi waktu bersifat fleksibel sesuai kebutuhan peserta didik.",
    "- Pendekatan pembelajaran mendorong eksplorasi, elaborasi, dan refleksi agar pembelajaran lebih mendalam.",
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ];

  return rawContent.join("\n");
}

function buildDemoBankSoalContent(data: Record<string, unknown>): string {
  const sekolah = demoText(data.sekolah, "Satuan Pendidikan");
  const namaGuru = demoText(data.namaGuru, "Nama Guru");
  const mapel = demoText(data.mapel || data.mataPelajaran, "Mata Pelajaran");
  const jenjang = demoText(data.jenjang, "Jenjang");
  const kelas = demoText(data.kelas || data.kelasFase, "Kelas");
  const semester = demoText(data.semester, "Ganjil");
  const tahunAjaran = demoText(data.tahunAjaran, "2026/2027");
  const kurikulum = demoText(data.kurikulum, "Kurikulum Merdeka");
  const topik = demoText(data.topik, "Materi Pembelajaran");
  const level = demoText(data.level, "Campuran LOTS & HOTS");
  const bentukSoal = demoText(data.bentukSoal, "Tidak ada");
  const jumlahPGRaw = Number(String(data.jumlahPG || "5").trim());
  const jumlahEsaiRaw = Number(String(data.jumlahEsai || "2").trim());
  const jumlahPG = Number.isFinite(jumlahPGRaw) && jumlahPGRaw > 0 ? Math.min(jumlahPGRaw, 10) : 5;
  const jumlahEsai = Number.isFinite(jumlahEsaiRaw) && jumlahEsaiRaw >= 0 ? Math.min(jumlahEsaiRaw, 5) : 2;
  const indikatorInput = String(data.indikator || data.capaianPembelajaran || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  const indikator = indikatorInput.length > 0
    ? indikatorInput
    : [
        `Mengidentifikasi konsep dasar ${topik}.`,
        `Menganalisis contoh atau penerapan ${topik}.`,
        `Menentukan jawaban paling tepat berdasarkan konteks ${topik}.`,
        `Menjelaskan alasan atau proses penyelesaian soal ${topik}.`,
      ];

  const pgQuestions = Array.from({ length: jumlahPG }, (_, index) => {
    const no = index + 1;
    const indikatorSoal = indikator[index % indikator.length];
    const isHots = level.includes("HOTS") && no % 2 === 0;
    return [
      `### Soal PG ${no}`,
      `${no}. ${isHots ? `Perhatikan konteks berikut terkait ${topik}, lalu tentukan jawaban yang paling tepat.` : `Pilih jawaban yang paling tepat tentang ${topik}.`}`,
      "",
      `A. Opsi pertama yang berkaitan dengan ${indikatorSoal.toLowerCase()}`,
      `B. Opsi kedua yang cukup masuk akal namun kurang tepat`,
      `C. Opsi ketiga yang paling tepat sesuai indikator soal`,
      `D. Opsi keempat sebagai pengecoh yang masih relevan`,
      "",
      `**Kunci Jawaban:** C`,
      `**Pembahasan:** Jawaban C paling tepat karena sesuai indikator "${indikatorSoal}" dan menuntut pemahaman ${topik} pada level ${isHots ? "analisis/penerapan" : "pemahaman dasar"}.`,
      "",
    ].join("\n");
  }).join("\n");

  const esaiQuestions = Array.from({ length: jumlahEsai }, (_, index) => {
    const no = index + 1;
    const indikatorSoal = indikator[(index + jumlahPG) % indikator.length];
    return [
      `### Soal Esai ${no}`,
      `${no}. Jelaskan ${indikatorSoal.toLowerCase()} dalam konteks materi ${topik}.`,
      "",
      "**Rambu Jawaban:**",
      `- Menjelaskan konsep inti ${topik} dengan bahasa yang runtut.`,
      `- Menggunakan contoh atau alasan yang relevan terhadap indikator "${indikatorSoal}".`,
      "- Menyampaikan jawaban secara sistematis dan logis.",
      "",
      "**Rubrik Singkat:**",
      "| Kriteria | Skor 4 | Skor 3 | Skor 2 | Skor 1 |",
      "| --- | --- | --- | --- | --- |",
      "| Ketepatan isi | Sangat tepat dan lengkap | Tepat dengan sedikit kekurangan | Cukup tepat | Belum tepat |",
      "| Argumentasi | Sangat runtut dan logis | Cukup runtut | Kurang runtut | Tidak runtut |",
      "| Contoh/dukungan | Sangat relevan | Relevan | Kurang relevan | Tidak relevan |",
      "",
    ].join("\n");
  }).join("\n");

  const tambahanSection = bentukSoal !== "Tidak ada"
    ? [
        "## Bentuk Soal Tambahan",
        `### ${bentukSoal}`,
        bentukSoal === "Isian Singkat"
          ? `1. Lengkapilah pernyataan berikut tentang ${topik}: ________________________________.`
          : bentukSoal === "Benar/Salah"
            ? `1. Pernyataan tentang ${topik}: "........" Tentukan Benar atau Salah disertai alasan singkat.`
            : `1. Jodohkan konsep ${topik} pada kolom A dengan penjelasan yang tepat pada kolom B.`,
        "",
        "**Kunci Jawaban Tambahan:**",
        "- Disesuaikan dengan indikator soal tambahan dan konteks materi.",
        "",
      ].join("\n")
    : "";

  const kisiRows = Array.from({ length: jumlahPG + jumlahEsai }, (_, index) => {
    const no = index + 1;
    const isPg = no <= jumlahPG;
    const indikatorSoal = indikator[(no - 1) % indikator.length];
    return `| ${no} | ${indikatorSoal} | ${isPg ? "Pilihan Ganda" : "Esai"} | ${level} | ${no} |`;
  }).join("\n");

  const totalSoal = jumlahPG + jumlahEsai + (bentukSoal !== "Tidak ada" ? 1 : 0);
  const lotsCount = level.includes("HOTS")
    ? Math.max(0, Math.floor(totalSoal * 0.4))
    : totalSoal;
  const hotsCount = level.includes("HOTS")
    ? totalSoal - lotsCount
    : level.includes("Campuran")
      ? Math.ceil(totalSoal / 2)
      : 0;

  const rawContent = [
    "# Bank Soal",
    "",
    "## Identitas",
    "| Komponen | Detail |",
    "| --- | --- |",
    `| Mata Pelajaran | ${mapel} |`,
    `| Jenjang | ${jenjang.toUpperCase()} |`,
    `| Kelas/Semester | ${kelas} / ${semester} |`,
    `| Kurikulum | ${kurikulum} |`,
    `| Tahun Ajaran | ${tahunAjaran} |`,
    `| Topik | ${topik} |`,
    `| Penyusun | ${namaGuru} |`,
    `| Satuan Pendidikan | ${sekolah} |`,
    "",
    "## Kisi-Kisi Soal",
    "| No | Indikator Soal | Bentuk Soal | Level Kognitif | Nomor Soal |",
    "| --- | --- | --- | --- | --- |",
    kisiRows,
    "",
    "## Soal Pilihan Ganda",
    pgQuestions,
    jumlahEsai > 0 ? "## Soal Uraian / Esai" : "",
    jumlahEsai > 0 ? esaiQuestions : "",
    tambahanSection,
    "## Distribusi Level Kognitif",
    "| Kategori | Jumlah Soal | Keterangan |",
    "| --- | --- | --- |",
    `| LOTS | ${lotsCount} | Soal pada level memahami, mengingat, dan menerapkan dasar |`,
    `| HOTS | ${hotsCount} | Soal pada level analisis, evaluasi, atau kreasi |`,
    `| Total | ${totalSoal} | Total seluruh butir soal pada dokumen ini |`,
    "",
    "> Mode demo untuk pengujian format. Konten ini template simulasi, bukan keluaran AI penuh.",
  ].filter(Boolean);

  return rawContent.join("\n");
}

export function generateDemoContent(toolSlug: string, data: Record<string, unknown>): string {
  const topik = String(data.topik || "Materi Pembelajaran");
  const mapel = String(data.mapel || data.mataPelajaran || "Mata Pelajaran");
  const kelas = String(data.kelas || data.kelasFase || "Kelas");

  if (toolSlug === "modul-ajar") {
    return buildDemoModulAjarContent(data);
  }

  if (toolSlug === "prota") {
    return buildDemoProtaContent(data);
  }

  if (toolSlug === "prosem") {
    return buildDemoProsemContent(data);
  }

  if (toolSlug === "lkpd") {
    return buildDemoLkpdContent(data);
  }

  if (toolSlug === "rubrik") {
    return buildDemoRubrikContent(data);
  }

  if (toolSlug === "silabus") {
    return buildDemoSilabusContent(data);
  }

  if (toolSlug === "bank-soal") {
    return buildDemoBankSoalContent(data);
  }

  if (toolSlug === "atp") {
    return `# ATP / Alur Tujuan Pembelajaran

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

## Identitas ATP
Dokumen ini memetakan capaian pembelajaran menjadi tujuan pembelajaran, materi, asesmen, dan alokasi waktu.

## Tabel Alur Tujuan Pembelajaran
| Pertemuan | Tujuan Pembelajaran | Materi Inti | Aktivitas Pembelajaran | Asesmen | Alokasi |
|---|---|---|---|---|---|
| 1 | Mengidentifikasi konsep dasar ${topik} | Konsep awal ${topik} | Observasi, diskusi, dan latihan singkat | Diagnostik dan formatif | 2 JP |
| 2 | Menjelaskan hubungan antarkonsep pada ${topik} | Penguatan konsep | Studi kasus dan presentasi kelompok | Lembar kerja | 2 JP |
| 3 | Menerapkan konsep ${topik} dalam konteks nyata | Aplikasi materi | Pemecahan masalah bertahap | Tugas kinerja | 2 JP |

## Tindak Lanjut
Guru menyesuaikan kecepatan alur berdasarkan hasil asesmen formatif.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "bahan-ajar") {
    return `# Bahan Ajar / Materi Ajar

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

## Tujuan Pembelajaran
Siswa mampu memahami konsep inti ${topik}, menjelaskan contoh penerapannya, dan menyelesaikan latihan sesuai jenjang.

## Materi Inti
${topik} dipelajari melalui pengenalan konsep, contoh kontekstual, latihan bertahap, dan refleksi.

## Contoh dan Pembahasan
1. Guru menyajikan kasus sederhana yang dekat dengan kehidupan siswa.
2. Siswa mengidentifikasi informasi penting.
3. Siswa menyusun jawaban dengan alasan yang jelas.

## Latihan
| No | Aktivitas | Bentuk Jawaban |
|---|---|---|
| 1 | Jelaskan pengertian utama dari ${topik}. | Uraian singkat |
| 2 | Berikan satu contoh penerapan ${topik}. | Contoh dan alasan |

## Rangkuman
Materi ${topik} menekankan pemahaman konsep, penerapan, dan refleksi belajar.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "kisi-kisi-soal") {
    return `# Kisi-Kisi Soal

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

| No | Materi | Indikator Soal | Level | Bentuk | Nomor Soal | Skor |
|---|---|---|---|---|---|---|
| 1 | ${topik} | Siswa mampu mengidentifikasi konsep dasar. | C1 | PG | 1 | 1 |
| 2 | ${topik} | Siswa mampu menjelaskan hubungan konsep. | C2 | PG | 2 | 1 |
| 3 | ${topik} | Siswa mampu menerapkan konsep dalam masalah. | C3 | Esai | 3 | 4 |

## Pedoman Singkat
Kisi-kisi digunakan untuk menjaga kesesuaian soal dengan indikator dan level kognitif.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "kartu-soal") {
    return `# Kartu Soal

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

## Kartu Soal 1
| Komponen | Isi |
|---|---|
| Materi | ${topik} |
| Indikator | Siswa mampu menerapkan konsep ${topik} pada situasi sederhana. |
| Level Kognitif | C3 |
| Bentuk Soal | Pilihan Ganda |

**Soal:** Pilihlah jawaban yang paling tepat berdasarkan konsep ${topik}.

**Kunci Jawaban:** A

**Pembahasan:** Jawaban A tepat karena sesuai dengan prinsip utama pada materi ${topik}.

## Rekap
Kartu soal ini dapat dikembangkan menjadi paket penilaian lengkap.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "analisis-penilaian") {
    return `# Analisis Hasil Penilaian

**Mapel:** ${mapel} | **Materi:** ${topik} | **Kelas:** ${kelas}

## Kriteria Ketuntasan
KKM/KKTP digunakan sebagai batas pemetaan siswa tuntas dan belum tuntas.

## Rekap Ketuntasan
| Kategori | Jumlah | Tindak Lanjut |
|---|---:|---|
| Tuntas | - | Pengayaan dan tantangan lanjutan |
| Belum Tuntas | - | Remedial bertahap |

## Analisis
Guru perlu memetakan butir atau indikator yang paling banyak belum dikuasai siswa, lalu memberi penguatan terarah.

## Tindak Lanjut
1. Remedial untuk konsep dasar ${topik}.
2. Pengayaan melalui tugas aplikasi kontekstual.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "remedial-pengayaan") {
    return `# Program Remedial dan Pengayaan

**Mapel:** ${mapel} | **Materi:** ${topik} | **Kelas:** ${kelas}

## Program Remedial
| Kegiatan | Tujuan | Bentuk Asesmen Ulang |
|---|---|---|
| Belajar ulang konsep inti | Memperbaiki pemahaman dasar ${topik} | Latihan bertahap |
| Bimbingan kelompok kecil | Mengatasi kesulitan spesifik | Kuis singkat |

## Program Pengayaan
| Kegiatan | Tujuan | Produk |
|---|---|---|
| Tantangan aplikasi | Memperluas pemahaman ${topik} | Presentasi / laporan mini |

## Kriteria Keberhasilan
Siswa menunjukkan peningkatan pemahaman dan mencapai batas ketuntasan yang ditetapkan.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  if (toolSlug === "asesmen-diagnostik") {
    return `# Asesmen Diagnostik

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

## Tujuan Diagnostik
Memetakan kesiapan awal siswa sebelum mempelajari ${topik}.

## Instrumen Kognitif
| No | Pertanyaan | Aspek yang Dipetakan |
|---|---|---|
| 1 | Apa yang sudah kamu ketahui tentang ${topik}? | Pengetahuan awal |
| 2 | Bagian mana yang menurutmu paling sulit? | Potensi miskonsepsi |

## Instrumen Non-kognitif
| No | Pertanyaan | Aspek |
|---|---|---|
| 1 | Bagaimana kebiasaan belajarmu di rumah? | Kemandirian belajar |
| 2 | Media belajar apa yang paling membantumu? | Preferensi belajar |

## Tindak Lanjut
Guru mengelompokkan siswa berdasarkan kesiapan dan merancang dukungan belajar yang sesuai.

> Mode demo untuk pengujian format. Hubungkan provider AI untuk keluaran penuh.`;
  }

  return `# ${toolSlug.toUpperCase().replace(/-/g, " ")}

**Mapel:** ${mapel} | **Topik:** ${topik} | **Kelas:** ${kelas}

Konten demo. Hubungkan OpenAI, Gemini, atau OpenRouter di Super Admin.

---
*Navalogi*`;
}
