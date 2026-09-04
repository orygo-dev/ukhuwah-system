import { sanitizeDocumentContent } from "@/lib/document-format";

export type ModulAjarSectionKey =
  | "identitasModul"
  | "kompetensiAwal"
  | "dimensiProfilLulusan"
  | "saranaPrasarana"
  | "targetPesertaDidik"
  | "capaianPembelajaran"
  | "tujuanPembelajaran"
  | "alurTujuanPembelajaran"
  | "pemahamanBermakna"
  | "pertanyaanPemantik"
  | "pendahuluan"
  | "kegiatanInti"
  | "penutup"
  | "asesmenDiagnostik"
  | "asesmenFormatif"
  | "asesmenSumatif"
  | "pengayaanRemedial"
  | "refleksiGuru"
  | "lembarKerjaBahanAjar"
  | "glosarium"
  | "daftarPustaka";

export type ModulAjarSections = Record<ModulAjarSectionKey, string>;

export type ModulAjarMeta = {
  sekolah: string;
  namaGuru: string;
  mapel: string;
  jenjang: string;
  kelas: string;
  semester: string;
  tahunAjaran: string;
  kelasSemester: string;
  fase: string;
  alokasiWaktu: string;
  topik: string;
  modelPembelajaran: string;
};

type ModulAjarSectionDefinition = {
  key: ModulAjarSectionKey;
  number: number;
  title: string;
  group: string;
  aliases?: string[];
};

export const DPL_OFFICIAL = [
  "Keimanan dan ketakwaan terhadap Tuhan Yang Maha Esa",
  "Kewargaan",
  "Penalaran Kritis",
  "Kreativitas",
  "Kolaborasi",
  "Kemandirian",
  "Kesehatan",
  "Komunikasi",
] as const;

const JENJANG: Record<string, string> = {
  sd: "SD/MI",
  smp: "SMP/MTs",
  sma: "SMA/MA",
  smk: "SMK/MAK",
};

const FASE_BY_JENJANG_KELAS: Record<string, Record<string, string>> = {
  sd: { "1": "A", "2": "A", "3": "B", "4": "B", "5": "C", "6": "C" },
  smp: { "7": "D", "8": "D", "9": "D" },
  sma: { "10": "E", "11": "E", "12": "F" },
  smk: { "10": "E", "11": "F", "12": "F" },
};

export const MODUL_AJAR_SECTION_DEFS: ModulAjarSectionDefinition[] = [
  {
    key: "identitasModul",
    number: 1,
    title: "Identitas Modul",
    group: "Bagian 1: Informasi Umum",
  },
  {
    key: "kompetensiAwal",
    number: 2,
    title: "Kompetensi Awal",
    group: "Bagian 1: Informasi Umum",
  },
  {
    key: "dimensiProfilLulusan",
    number: 3,
    title: "Dimensi Profil Lulusan (DPL)",
    group: "Bagian 1: Informasi Umum",
    aliases: ["Dimensi Profil Lulusan"],
  },
  {
    key: "saranaPrasarana",
    number: 4,
    title: "Sarana dan Prasarana",
    group: "Bagian 1: Informasi Umum",
    aliases: ["Sarana Prasarana"],
  },
  {
    key: "targetPesertaDidik",
    number: 5,
    title: "Target Peserta Didik",
    group: "Bagian 1: Informasi Umum",
    aliases: ["Peserta Didik"],
  },
  {
    key: "capaianPembelajaran",
    number: 6,
    title: "Capaian Pembelajaran (CP)",
    group: "Bagian 2: Komponen Inti",
    aliases: ["Capaian Pembelajaran"],
  },
  {
    key: "tujuanPembelajaran",
    number: 7,
    title: "Tujuan Pembelajaran (TP)",
    group: "Bagian 2: Komponen Inti",
    aliases: ["Tujuan Pembelajaran"],
  },
  {
    key: "alurTujuanPembelajaran",
    number: 8,
    title: "Alur Tujuan Pembelajaran (ATP)",
    group: "Bagian 2: Komponen Inti",
    aliases: ["Alur Tujuan Pembelajaran", "ATP"],
  },
  {
    key: "pemahamanBermakna",
    number: 9,
    title: "Pemahaman Bermakna",
    group: "Bagian 2: Komponen Inti",
    aliases: ["Materi Pelajaran", "Topik Pembelajaran", "Lintas Disiplin Ilmu"],
  },
  {
    key: "pertanyaanPemantik",
    number: 10,
    title: "Pertanyaan Pemantik",
    group: "Bagian 2: Komponen Inti",
  },
  {
    key: "pendahuluan",
    number: 11,
    title: "Pendahuluan",
    group: "Bagian 3: Kegiatan Pembelajaran",
    aliases: ["Awal"],
  },
  {
    key: "kegiatanInti",
    number: 12,
    title: "Kegiatan Inti",
    group: "Bagian 3: Kegiatan Pembelajaran",
    aliases: [
      "Inti",
      "Memahami",
      "Mengaplikasi",
      "Merefleksi",
      "Praktik Pedagogis",
      "Kemitraan Pembelajaran",
      "Lingkungan Pembelajaran",
      "Pemanfaatan Digital",
    ],
  },
  {
    key: "penutup",
    number: 13,
    title: "Penutup",
    group: "Bagian 3: Kegiatan Pembelajaran",
  },
  {
    key: "asesmenDiagnostik",
    number: 14,
    title: "Asesmen Diagnostik",
    group: "Bagian 4: Asesmen",
    aliases: ["Asesmen pada Awal Pembelajaran", "Asesmen Diagnostik (Awal Pertemuan 1)"],
  },
  {
    key: "asesmenFormatif",
    number: 15,
    title: "Asesmen Formatif",
    group: "Bagian 4: Asesmen",
    aliases: ["Asesmen pada Proses Pembelajaran", "Asesmen Formatif (Selama Proses)"],
  },
  {
    key: "asesmenSumatif",
    number: 16,
    title: "Asesmen Sumatif",
    group: "Bagian 4: Asesmen",
    aliases: [
      "Asesmen pada Akhir Pembelajaran",
      "Rubrik Penilaian",
      "Rubrik Penilaian Diskusi Kelas",
      "Keterangan",
      "Keterangan Rubrik",
    ],
  },
  {
    key: "pengayaanRemedial",
    number: 17,
    title: "Pengayaan dan Remedial",
    group: "Bagian 5: Lampiran",
  },
  {
    key: "refleksiGuru",
    number: 18,
    title: "Refleksi Guru",
    group: "Bagian 5: Lampiran",
  },
  {
    key: "lembarKerjaBahanAjar",
    number: 19,
    title: "Lembar Kerja / Bahan Ajar",
    group: "Bagian 5: Lampiran",
    aliases: ["Lembar Kerja", "Bahan Ajar"],
  },
  {
    key: "glosarium",
    number: 20,
    title: "Glosarium",
    group: "Bagian 5: Lampiran",
  },
  {
    key: "daftarPustaka",
    number: 21,
    title: "Daftar Pustaka",
    group: "Bagian 5: Lampiran",
  },
];

const HEADING_TO_SECTION = new Map<
  string,
  { key: ModulAjarSectionKey; preserveHeading: boolean }
>();

for (const section of MODUL_AJAR_SECTION_DEFS) {
  HEADING_TO_SECTION.set(normalizeHeading(section.title), {
    key: section.key,
    preserveHeading: false,
  });
  for (const alias of section.aliases ?? []) {
    HEADING_TO_SECTION.set(normalizeHeading(alias), {
      key: section.key,
      preserveHeading: normalizeHeading(alias) !== normalizeHeading(section.title),
    });
  }
}

function inferFase(jenjang: string, kelas: string): string {
  return FASE_BY_JENJANG_KELAS[jenjang]?.[kelas] || "";
}

function normalizeHeading(line: string): string {
  return line
    .replace(/^#+\s*/, "")
    .replace(/^BAGIAN\s+\d+\s*:\s*/i, "")
    .replace(/^\d+\s*[\.\-:)]\s*/, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function safeValue(value: string): string {
  return value.trim() || "-";
}

function emptySections(): ModulAjarSections {
  return {
    identitasModul: "",
    kompetensiAwal: "",
    dimensiProfilLulusan: "",
    saranaPrasarana: "",
    targetPesertaDidik: "",
    capaianPembelajaran: "",
    tujuanPembelajaran: "",
    alurTujuanPembelajaran: "",
    pemahamanBermakna: "",
    pertanyaanPemantik: "",
    pendahuluan: "",
    kegiatanInti: "",
    penutup: "",
    asesmenDiagnostik: "",
    asesmenFormatif: "",
    asesmenSumatif: "",
    pengayaanRemedial: "",
    refleksiGuru: "",
    lembarKerjaBahanAjar: "",
    glosarium: "",
    daftarPustaka: "",
  };
}

function appendSection(
  sections: ModulAjarSections,
  key: ModulAjarSectionKey | null,
  buffer: string[]
) {
  if (!key || buffer.length === 0) return;
  const text = buffer.join("\n").trim();
  if (!text) {
    buffer.length = 0;
    return;
  }
  sections[key] = sections[key] ? `${sections[key]}\n\n${text}` : text;
  buffer.length = 0;
}

function buildIdentitasTable(meta: ModulAjarMeta): string {
  return [
    "| Komponen | Deskripsi |",
    "| --- | --- |",
    `| Penyusun | ${safeValue(meta.namaGuru)} |`,
    `| Institusi | ${safeValue(meta.sekolah)} |`,
    `| Tahun Ajaran | ${safeValue(meta.tahunAjaran)} |`,
    `| Jenjang | ${safeValue(meta.jenjang)} |`,
    `| Kelas | ${safeValue(meta.kelas)} |`,
    `| Fase | ${safeValue(meta.fase)} |`,
    `| Mata Pelajaran | ${safeValue(meta.mapel)} |`,
    `| Topik | ${safeValue(meta.topik)} |`,
    `| Semester | ${safeValue(meta.semester)} |`,
    `| Alokasi Waktu | ${safeValue(meta.alokasiWaktu)} |`,
    `| Model Pembelajaran | ${safeValue(meta.modelPembelajaran)} |`,
  ].join("\n");
}

function buildDplTable(raw: string): string {
  const values = raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  if (values.length === 0) return "";
  return [
    "| Dimensi | Implementasi dalam Pembelajaran |",
    "| --- | --- |",
    ...values.map(
      (value) =>
        `| ${value} | Dikembangkan melalui aktivitas ${safeValue(
          value.toLowerCase()
        )} yang terhubung langsung dengan topik pembelajaran. |`
    ),
  ].join("\n");
}

function buildSaranaPrasaranaTable(
  meta: ModulAjarMeta,
  input?: Record<string, unknown> | null
): string {
  const media = cleanText(input?.media);
  const lingkungan = cleanText(input?.lingkungan);
  const digital = cleanText(input?.pemanfaatanDigital);
  const kemitraan = cleanText(input?.kemitraan);
  return [
    "| Jenis | Rincian |",
    "| --- | --- |",
    `| Alat | Perangkat pembelajaran untuk topik ${safeValue(meta.topik)} sesuai kebutuhan kelas ${safeValue(meta.kelas)}. |`,
    `| Bahan | Bahan ajar utama, LKPD, serta instrumen asesmen formatif dan sumatif. |`,
    `| Media | ${safeValue(media || "Slide, lembar kerja, dan media visual kontekstual.")} |`,
    `| Sumber Belajar | ${safeValue(
      [lingkungan, digital, kemitraan].filter(Boolean).join("; ") ||
        "Buku teks, lingkungan belajar, dan sumber digital yang relevan."
    )} |`,
  ].join("\n");
}

function buildTargetPesertaDidik(meta: ModulAjarMeta, input?: Record<string, unknown> | null): string {
  const readiness = cleanText(input?.kesiapanPesertaDidik);
  if (readiness) return readiness;
  return [
    "**Karakteristik umum:**",
    `- Peserta didik jenjang ${safeValue(meta.jenjang)} kelas ${safeValue(meta.kelas)} dengan kebutuhan belajar yang beragam.`,
    `- Memiliki pengalaman awal yang berkaitan dengan topik ${safeValue(meta.topik)} pada konteks kehidupan sehari-hari.`,
    "- Membutuhkan arahan bertahap, latihan terstruktur, dan umpan balik yang konsisten.",
    "",
    "**Kebutuhan diferensiasi:**",
    "- Konten: variasi contoh, bacaan, atau stimulus sesuai kesiapan belajar.",
    "- Proses: pendampingan, diskusi kelompok, dan tugas bertahap sesuai ritme siswa.",
    "- Produk: pilihan bentuk hasil kerja seperti presentasi, lembar kerja, atau proyek mini.",
  ].join("\n");
}

function buildAtpTable(input?: Record<string, unknown> | null): string {
  const topik = cleanText(input?.topik) || "materi pembelajaran";
  const pertemuanRaw = Number(cleanText(input?.jumlahPertemuan) || "1");
  const pertemuan = Number.isFinite(pertemuanRaw) && pertemuanRaw > 0 ? pertemuanRaw : 1;
  const rows = Array.from({ length: pertemuan }, (_, index) => {
    const no = index + 1;
    return `| ${no} | Eksplorasi dan penguatan ${topik} pada konteks pertemuan ${no}. | Tujuan pembelajaran pertemuan ${no} untuk ${topik}. |`;
  });
  return ["| Pertemuan | Alur Kegiatan | TP yang Dicapai |", "| --- | --- | --- |", ...rows].join(
    "\n"
  );
}

function buildPertanyaanPemantik(input?: Record<string, unknown> | null): string {
  const topik = cleanText(input?.topik) || "materi ini";
  return [
    `1. Mengapa ${topik} penting dipahami dalam konteks kehidupan sehari-hari?`,
    `2. Bagaimana cara menerapkan konsep ${topik} saat menghadapi masalah nyata?`,
    `3. Apa dampak jika konsep ${topik} digunakan secara kurang tepat?`,
  ].join("\n");
}

function buildPemahamanBermakna(input?: Record<string, unknown> | null): string {
  const topik = cleanText(input?.topik) || "materi pembelajaran";
  const analisis = cleanText(input?.analisisMateri);
  if (analisis) return analisis;
  return [
    `Pemahaman terhadap ${topik} membantu peserta didik mengaitkan konsep akademik dengan situasi nyata di lingkungan sekitar.`,
    "",
    `- Peserta didik memahami manfaat praktis ${topik} dalam kehidupan sehari-hari.`,
    `- Peserta didik mampu mengambil keputusan berdasarkan konsep ${topik} secara logis dan bertanggung jawab.`,
    `- Peserta didik membangun kebiasaan berpikir kritis melalui penerapan ${topik}.`,
  ].join("\n");
}

function extractClosingLine(content: string, meta: ModulAjarMeta): string {
  const existing =
    content.match(/^\*\*Disusun oleh:\*\*.*$/im)?.[0] ||
    content.match(/^Disusun oleh:.*$/im)?.[0];
  if (existing) return existing.trim();
  return `**Disusun oleh:** ${safeValue(meta.namaGuru)}, ${safeValue(meta.mapel)}, ${safeValue(
    meta.sekolah
  )}, Tahun Ajaran ${safeValue(meta.tahunAjaran)}`;
}

export function parseModulAjarSections(content: string): ModulAjarSections {
  const sections = emptySections();
  const lines = sanitizeDocumentContent(content).split("\n");
  let currentKey: ModulAjarSectionKey | null = null;
  const buffer: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawHeading = headingMatch[2].trim();
      const mapped = HEADING_TO_SECTION.get(normalizeHeading(rawHeading));
      if (mapped) {
        appendSection(sections, currentKey, buffer);
        currentKey = mapped.key;
        if (mapped.preserveHeading) {
          buffer.push(`#### ${rawHeading}`);
        }
        continue;
      }
      if (level <= 2) {
        appendSection(sections, currentKey, buffer);
        currentKey = null;
        continue;
      }
    }
    if (currentKey) buffer.push(line);
  }

  appendSection(sections, currentKey, buffer);
  return sections;
}

export function buildModulAjarMeta(input?: Record<string, unknown> | null): ModulAjarMeta {
  const jenjangKey = cleanText(input?.jenjang);
  const jenjang = jenjangKey ? JENJANG[jenjangKey] || jenjangKey : "";
  const kelas = cleanText(input?.kelas);
  const semester = cleanText(input?.semester);
  const fase = inferFase(jenjangKey, kelas);

  return {
    sekolah: cleanText(input?.sekolah),
    namaGuru: cleanText(input?.namaGuru),
    mapel: cleanText(input?.mapel),
    jenjang,
    kelas,
    semester,
    tahunAjaran: cleanText(input?.tahunAjaran),
    kelasSemester: [kelas, semester].filter(Boolean).join(" / "),
    fase,
    alokasiWaktu: cleanText(input?.alokasiWaktu),
    topik: cleanText(input?.topik),
    modelPembelajaran:
      cleanText(input?.praktikPedagogis) || cleanText(input?.modelPembelajaran),
  };
}

export function getModulAjarTitle(input?: Record<string, unknown> | null): string {
  const meta = buildModulAjarMeta(input);
  return meta.mapel ? `MODUL AJAR ${meta.mapel.toUpperCase()}` : "MODUL AJAR";
}

export function enrichSections(
  sections: ModulAjarSections,
  input?: Record<string, unknown> | null
): ModulAjarSections {
  const meta = buildModulAjarMeta(input);
  const enriched = { ...sections };

  if (!enriched.identitasModul) enriched.identitasModul = buildIdentitasTable(meta);
  if (!enriched.kompetensiAwal && input?.kesiapanPesertaDidik) {
    enriched.kompetensiAwal = cleanText(input.kesiapanPesertaDidik);
  }
  if (!enriched.dimensiProfilLulusan && input?.dimensiProfilLulusan) {
    enriched.dimensiProfilLulusan = buildDplTable(cleanText(input.dimensiProfilLulusan));
  }
  if (!enriched.saranaPrasarana) enriched.saranaPrasarana = buildSaranaPrasaranaTable(meta, input);
  if (!enriched.targetPesertaDidik) enriched.targetPesertaDidik = buildTargetPesertaDidik(meta, input);
  if (!enriched.capaianPembelajaran && input?.capaianPembelajaran) {
    enriched.capaianPembelajaran = cleanText(input.capaianPembelajaran);
  }
  if (!enriched.tujuanPembelajaran && input?.tujuanPembelajaran) {
    enriched.tujuanPembelajaran = cleanText(input.tujuanPembelajaran);
  }
  if (!enriched.alurTujuanPembelajaran) enriched.alurTujuanPembelajaran = buildAtpTable(input);
  if (!enriched.pemahamanBermakna) enriched.pemahamanBermakna = buildPemahamanBermakna(input);
  if (!enriched.pertanyaanPemantik) enriched.pertanyaanPemantik = buildPertanyaanPemantik(input);

  return enriched;
}

export function composeModulAjarMarkdown(
  content: string,
  input?: Record<string, unknown> | null
): string {
  const meta = buildModulAjarMeta(input);
  const sections = enrichSections(parseModulAjarSections(content), input);
  const lines: string[] = [
    `# ${getModulAjarTitle(input)}`,
    "## KURIKULUM MERDEKA - PENDEKATAN PEMBELAJARAN MENDALAM",
    "",
    "---",
    "",
  ];

  let currentGroup = "";
  for (const section of MODUL_AJAR_SECTION_DEFS) {
    if (section.group !== currentGroup) {
      if (currentGroup) {
        lines.push("---", "");
      }
      currentGroup = section.group;
      lines.push(`## ${section.group}`, "");
    }

    lines.push(`### ${section.number}. ${section.title}`);
    const body = sections[section.key].trim();
    if (body) {
      lines.push(body, "");
    } else {
      lines.push("");
    }
  }

  lines.push("---", "", extractClosingLine(content, meta));
  return sanitizeDocumentContent(lines.join("\n"));
}

export const MODUL_AJAR_TEMPLATE_OUTLINE = composeModulAjarMarkdown("", null);
