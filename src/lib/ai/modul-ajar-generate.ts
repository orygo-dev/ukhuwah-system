import type { AiProvider } from "@prisma/client";
import { callProviderDetailed } from "@/lib/ai/provider";
import {
  buildUserPrompt,
  getDocumentTitle,
  type GenerateInput,
} from "@/lib/ai/prompts";
import { sanitizeDocumentContent } from "@/lib/document-format";
import { DOCUMENT_OUTPUT_RULES } from "@/lib/document-format";
import {
  MODUL_AJAR_SEQOLAH_OUTLINE,
  SEQOLAH_QUALITY_RULES,
} from "@/lib/templates/seqolah-modul-ajar";
import {
  SEQOLAH_FEW_SHOT_EXCERPT,
  validateModulAjarQuality,
} from "@/lib/ai/modul-ajar-quality";
import type { AiUsageContext } from "@/lib/ai/usage-tracking";

const MODUL_AJAR_MAX_TOKENS = 16384;
const MODUL_AJAR_TEMPERATURE = 0.45;

const PHASE_1_SYSTEM = `${DOCUMENT_OUTPUT_RULES}

Anda adalah penulis modul ajar profesional Indonesia berpengalaman 15+ tahun (setara platform komersial seqolah.com).

${SEQOLAH_QUALITY_RULES}

${SEQOLAH_FEW_SHOT_EXCERPT}

TUGAS FASE INI: Tulis **Bagian 1 (Informasi Umum)** dan **Bagian 2 (Komponen Inti)** — bagian 1 sampai 10.
Gunakan heading Markdown persis: ### 1. Identitas Modul ... ### 10. Pertanyaan Pemantik
Minimal 1.200 kata. Semua tabel terisi konkret. Jangan tulis bagian 11 ke atas.`;

const PHASE_2_SYSTEM = `${DOCUMENT_OUTPUT_RULES}

Anda melanjutkan modul ajar profesional (setara seqolah.com) — FASE 2.

${SEQOLAH_QUALITY_RULES}

${SEQOLAH_FEW_SHOT_EXCERPT}

TUGAS FASE INI: Tulis **Bagian 3 (Kegiatan Pembelajaran)**, **Bagian 4 (Asesmen)**, dan **Bagian 5 (Lampiran)** — bagian 11 sampai 21.
- Kegiatan inti: SATU subbagian per pertemuan dengan tabel Langkah | Aktivitas Guru | Aktivitas Siswa | Waktu
- Sertakan LKPD 1 & 2 lengkap, glosarium ≥8 istilah, daftar pustaka ≥3 referensi
- Akhiri dengan baris penutup: **Disusun oleh:** [nama guru], [sekolah], [tahun ajaran]
Minimal 2.000 kata. Jangan ulangi bagian 1-10.`;

const CONTINUE_SYSTEM = `${DOCUMENT_OUTPUT_RULES}

Lanjutkan modul ajar dari bagian yang BELUM ada. Tulis HANYA bagian yang hilang — jangan ulangi bagian yang sudah ada.`;

function withAdminOverride(system: string, promptOverride?: string | null): string {
  const override = promptOverride?.trim();
  if (!override) return system;
  return `${system}

PREFERENSI ADMIN (WAJIB DIIKUTI SELAMA TIDAK BERTENTANGAN DENGAN STRUKTUR 21 BAGIAN):
${override}`;
}

export function tuneProviderForModulAjar(provider: AiProvider): AiProvider {
  let tuned = { ...provider, maxTokens: Math.max(provider.maxTokens, MODUL_AJAR_MAX_TOKENS) };
  tuned = {
    ...tuned,
    temperature: MODUL_AJAR_TEMPERATURE as unknown as typeof provider.temperature,
  };
  if (tuned.slug === "gemini" && tuned.defaultModel.includes("flash")) {
    tuned = { ...tuned, defaultModel: "gemini-2.5-pro" };
  }
  return tuned;
}

async function callPhase(
  provider: AiProvider,
  system: string,
  user: string,
  context?: AiUsageContext
): Promise<string> {
  const tuned = tuneProviderForModulAjar(provider);
  const result = await callProviderDetailed(
    tuned,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    undefined,
    context
  );
  const content = result.content;
  if (!content?.trim()) throw new Error("Respons AI kosong");
  return sanitizeDocumentContent(content);
}

function buildPhase1User(input: GenerateInput): string {
  const base = buildUserPrompt(input.toolSlug, input.data);
  return `${base}

Tulis Bagian 1 dan 2 (poin 1–10) sekarang. Mulai dengan:
# MODUL AJAR [MAPEL SESUAI INPUT]
## KURIKULUM MERDEKA — PENDEKATAN PEMBELAJARAN MENDALAM`;
}

function buildPhase2User(input: GenerateInput, phase1: string): string {
  const base = buildUserPrompt(input.toolSlug, input.data);
  const context = phase1.slice(-3500);
  return `${base}

KONTEKS BAGIAN 1–10 YANG SUDAH DITULIS (jangan diulang):
---
${context}
---

Lanjutkan dengan Bagian 3, 4, dan 5 (poin 11–21) yang selaras dengan konteks di atas.`;
}

function buildContinueUser(
  existing: string,
  missing: string[]
): string {
  return `Dokumen berikut TERPOTONG atau belum memiliki bagian: ${missing.join(", ")}.

Tulis HANYA bagian yang hilang, format Markdown, selaras dengan gaya dokumen existing.

DOKUMEN EXISTING (cuplikan akhir):
---
${existing.slice(-4000)}
---`;
}

function mergePhases(phase1: string, phase2: string): string {
  return sanitizeDocumentContent(`${phase1.trim()}\n\n---\n\n${phase2.trim()}`);
}

export type ModulAjarGenerateResult = {
  content: string;
  title: string;
  phases: number;
  quality: ReturnType<typeof validateModulAjarQuality>;
};

/**
 * Pipeline 2-fase + kelanjutan otomatis — meniru pendekatan platform komersial
 * untuk dokumen panjang tanpa terpotong di tengah.
 */
export async function generateModulAjarWithProvider(
  input: GenerateInput,
  provider: AiProvider,
  promptOverride?: string | null,
  context?: AiUsageContext
): Promise<ModulAjarGenerateResult> {
  const title = getDocumentTitle(input.toolSlug, input.data);
  let phases = 0;

  const phase1 = await callPhase(
    provider,
    withAdminOverride(PHASE_1_SYSTEM, promptOverride),
    buildPhase1User(input),
    context ? { ...context, phase: "modul-ajar-phase-1" } : undefined
  );
  phases = 1;

  const phase2 = await callPhase(
    provider,
    withAdminOverride(PHASE_2_SYSTEM, promptOverride),
    buildPhase2User(input, phase1),
    context ? { ...context, phase: "modul-ajar-phase-2" } : undefined
  );
  phases = 2;

  let content = mergePhases(phase1, phase2);
  let quality = validateModulAjarQuality(content);

  if (!quality.ok && quality.missingSections.length > 0) {
    const continued = await callPhase(
      provider,
      withAdminOverride(CONTINUE_SYSTEM, promptOverride),
      buildContinueUser(content, quality.missingSections),
      context ? { ...context, phase: "modul-ajar-continuation" } : undefined
    );
    phases = 3;
    content = sanitizeDocumentContent(`${content}\n\n${continued}`);
    quality = validateModulAjarQuality(content);
  }

  return { content, title, phases, quality };
}

export const MODUL_AJAR_FULL_OUTLINE = MODUL_AJAR_SEQOLAH_OUTLINE;
