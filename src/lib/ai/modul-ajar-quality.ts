/**
 * Validasi kualitas modul ajar — memastikan output setara standar komersial.
 */

export const MODUL_AJAR_REQUIRED_HEADINGS = [
  "Identitas Modul",
  "Kompetensi Awal",
  "Dimensi Profil Lulusan",
  "Sarana dan Prasarana",
  "Target Peserta Didik",
  "Capaian Pembelajaran",
  "Tujuan Pembelajaran",
  "Alur Tujuan Pembelajaran",
  "Pemahaman Bermakna",
  "Pertanyaan Pemantik",
  "Pendahuluan",
  "Kegiatan Inti",
  "Penutup",
  "Asesmen Diagnostik",
  "Asesmen Formatif",
  "Asesmen Sumatif",
  "Pengayaan dan Remedial",
  "Refleksi Guru",
  "Lembar Kerja",
  "Glosarium",
  "Daftar Pustaka",
] as const;

export type ModulAjarQualityReport = {
  ok: boolean;
  wordCount: number;
  missingSections: string[];
  tableCount: number;
  message: string;
};

export function countWords(text: string): number {
  return text
    .replace(/[#*|_\-`]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1).length;
}

export function countMarkdownTables(text: string): number {
  const lines = text.split("\n");
  let tables = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (
      lines[i].trim().startsWith("|") &&
      /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])
    ) {
      tables++;
    }
  }
  return tables;
}

export function validateModulAjarQuality(content: string): ModulAjarQualityReport {
  const normalized = content.toLowerCase();
  const missingSections = MODUL_AJAR_REQUIRED_HEADINGS.filter(
    (h) => !normalized.includes(h.toLowerCase())
  );
  const wordCount = countWords(content);
  const tableCount = countMarkdownTables(content);

  const ok =
    missingSections.length <= 2 &&
    wordCount >= 2000 &&
    tableCount >= 8;

  let message = `≈${wordCount} kata, ${tableCount} tabel`;
  if (missingSections.length > 0) {
    message += ` — belum lengkap: ${missingSections.slice(0, 4).join(", ")}`;
  }

  return { ok, wordCount, missingSections: [...missingSections], tableCount, message };
}

/** Contoh potongan kualitas emas (dari referensi seqolah.com) — few-shot untuk AI */
export const SEQOLAH_FEW_SHOT_EXCERPT = `
CONTOH GAYA PENULISAN PROFESIONAL (WAJIB meniru kedalaman & format ini):

### 7. Tujuan Pembelajaran (TP)
| No | Tujuan Pembelajaran |
| TP 1 | Setelah mengamati contoh dan diskusi kelompok, peserta didik mampu **mengidentifikasi** (C1) struktur materi dari 3 sumber berbeda dengan **ketepatan minimal 80%** |
| TP 2 | Setelah menganalisis materi, peserta didik mampu **membedakan** (C4) ciri kebahasaan/konsep dari jenis lain secara **tepat** |

### 11. Pendahuluan (±15% = 27 Menit)
| Tahap | Aktivitas Guru | Aktivitas Siswa | Waktu |
| Salam & Doa | Memberi salam, meminta ketua kelas memimpin doa | Menjawab salam, berdoa bersama | 3 menit |
| Apersepsi | Menunjukkan stimulus kontekstual terkait topik, bertanya memancing penalaran | Mengamati, menjawab pertanyaan awal | 7 menit |
| Motivasi | Memutar video singkat relevan dengan kehidupan siswa | Menonton, menuliskan 1 manfaat materi di sticky note | 5 menit |

### 12. Kegiatan Inti — Pertemuan 1: [judul spesifik topik]
| Langkah Model | Aktivitas Guru | Aktivitas Siswa | Waktu |
| Orientasi | Menyajikan pertanyaan mendasar proyek/masalah autentik | Berdiskusi kelompok memahami tantangan | 10 menit |
| Eksplorasi | Membagikan LKPD, memandu analisis | Mengisi LKPD, menganalisis contoh | 25 menit |

DILARANG menulis ringkasan satu paragraf untuk kegiatan inti. WAJIB tabel per tahap dengan waktu dalam menit.
`.trim();
