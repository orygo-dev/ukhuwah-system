export type Option = { value: string; label: string };

export const JENJANG_OPTIONS: Option[] = [
  { value: "sd", label: "SD / MI" },
  { value: "smp", label: "SMP / MTs" },
  { value: "sma", label: "SMA / MA" },
  { value: "smk", label: "SMK / MAK" },
];

export type JenjangCode = "sd" | "smp" | "sma" | "smk";

/**
 * Normalizes legacy/free-form class levels without changing stored historical data.
 * New writes should still persist one of the canonical JENJANG_OPTIONS values.
 */
export function normalizeJenjang(value?: string | null): JenjangCode | "" {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["sd", "mi"].includes(normalized) || /\b(sd|mi)\b/.test(normalized)) return "sd";
  if (["smp", "mts"].includes(normalized) || /\b(smp|mts)\b/.test(normalized)) return "smp";
  if (["smk", "mak"].includes(normalized) || /\b(smk|mak)\b/.test(normalized)) return "smk";
  if (["sma", "ma"].includes(normalized) || /\b(sma|ma)\b/.test(normalized)) return "sma";

  const compact = normalized.replace(/[^a-z0-9]/g, "");
  if (/^(kelas)?(10|11|12|13|x|xi|xii|xiii)$/.test(compact)) return "sma";
  if (/^(kelas)?(7|8|9|vii|viii|ix)$/.test(compact)) return "smp";
  if (/^(kelas)?(1|2|3|4|5|6|i|ii|iii|iv|v|vi)$/.test(compact)) return "sd";
  return "";
}

export function isCanonicalJenjang(value: string): value is JenjangCode {
  return JENJANG_OPTIONS.some((option) => option.value === value);
}

const KELAS_BY_JENJANG: Record<string, Option[]> = {
  sd: [
    { value: "Kelas 1", label: "Kelas 1 (Fase A)" },
    { value: "Kelas 2", label: "Kelas 2 (Fase A)" },
    { value: "Kelas 3", label: "Kelas 3 (Fase B)" },
    { value: "Kelas 4", label: "Kelas 4 (Fase B)" },
    { value: "Kelas 5", label: "Kelas 5 (Fase C)" },
    { value: "Kelas 6", label: "Kelas 6 (Fase C)" },
  ],
  smp: [
    { value: "Kelas 7", label: "Kelas 7 (Fase D)" },
    { value: "Kelas 8", label: "Kelas 8 (Fase D)" },
    { value: "Kelas 9", label: "Kelas 9 (Fase D)" },
  ],
  sma: [
    { value: "Kelas 10", label: "Kelas 10 (Fase E)" },
    { value: "Kelas 11", label: "Kelas 11 (Fase F)" },
    { value: "Kelas 12", label: "Kelas 12 (Fase F)" },
  ],
  smk: [
    { value: "Kelas 10", label: "Kelas 10 (Fase E)" },
    { value: "Kelas 11", label: "Kelas 11 (Fase F)" },
    { value: "Kelas 12", label: "Kelas 12 (Fase F)" },
    { value: "Kelas 13", label: "Kelas 13 (Fase F — program 4 tahun)" },
  ],
};

const MAPEL_SD = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPAS (Ilmu Pengetahuan Alam dan Sosial)",
  "Bahasa Inggris",
  "PJOK",
  "Seni Musik",
  "Seni Rupa",
  "Seni Teater",
  "Seni Tari",
  "Muatan Lokal",
];

const MAPEL_SMP = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "IPA (Ilmu Pengetahuan Alam)",
  "IPS (Ilmu Pengetahuan Sosial)",
  "Bahasa Inggris",
  "PJOK",
  "Informatika",
  "Seni Budaya (Musik/Rupa/Teater/Tari)",
  "Prakarya",
  "Muatan Lokal",
];

const MAPEL_SMA = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Bahasa Inggris",
  "PJOK",
  "Sejarah",
  "Seni Budaya",
  "Fisika",
  "Kimia",
  "Biologi",
  "Ekonomi",
  "Geografi",
  "Sosiologi",
  "Antropologi",
  "Informatika",
  "Matematika Tingkat Lanjut",
  "Bahasa Indonesia Tingkat Lanjut",
  "Bahasa Inggris Tingkat Lanjut",
  "Bahasa Arab",
  "Bahasa Mandarin",
  "Bahasa Jepang",
  "Bahasa Jerman",
  "Bahasa Prancis",
  "Bahasa Korea",
  "Prakarya dan Kewirausahaan",
  "Muatan Lokal",
];

const MAPEL_SMK = [
  "Pendidikan Agama dan Budi Pekerti",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Bahasa Inggris",
  "PJOK",
  "Sejarah",
  "Seni Budaya",
  "Informatika",
  "Projek Ilmu Pengetahuan Alam dan Sosial (IPAS)",
  "Dasar-dasar Program Keahlian",
  "Konsentrasi Keahlian",
  "Projek Kreatif dan Kewirausahaan",
  "Mata Pelajaran Pilihan",
  "Praktik Kerja Lapangan (PKL)",
  "Muatan Lokal",
];

const MAPEL_BY_JENJANG: Record<string, string[]> = {
  sd: MAPEL_SD,
  smp: MAPEL_SMP,
  sma: MAPEL_SMA,
  smk: MAPEL_SMK,
};

export const MODEL_PEMBELAJARAN: Option[] = [
  { value: "Problem Based Learning (PBL)", label: "Problem Based Learning (PBL)" },
  { value: "Project Based Learning (PjBL)", label: "Project Based Learning (PjBL)" },
  { value: "Discovery Learning", label: "Discovery Learning" },
  { value: "Inquiry Learning", label: "Inquiry Learning" },
  { value: "Cooperative Learning", label: "Cooperative Learning" },
  { value: "Contextual Teaching and Learning (CTL)", label: "Contextual Teaching & Learning (CTL)" },
  { value: "Pembelajaran Langsung (Direct Instruction)", label: "Pembelajaran Langsung (Direct Instruction)" },
  { value: "Pendekatan Saintifik (5M)", label: "Pendekatan Saintifik (5M)" },
  { value: "Pembelajaran Berdiferensiasi", label: "Pembelajaran Berdiferensiasi" },
  { value: "Teaching at the Right Level (TaRL)", label: "Teaching at the Right Level (TaRL)" },
  { value: "Culturally Responsive Teaching (CRT)", label: "Culturally Responsive Teaching (CRT)" },
  { value: "Blended Learning", label: "Blended Learning" },
  { value: "Flipped Classroom", label: "Flipped Classroom" },
  { value: "Game Based Learning", label: "Game Based Learning" },
  { value: "STEAM", label: "STEAM" },
];

/** 8 Dimensi Profil Lulusan (Pembelajaran Mendalam 2025). */
export const DIMENSI_PROFIL_LULUSAN: Option[] = [
  { value: "Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa", label: "Keimanan & Ketakwaan kepada Tuhan YME" },
  { value: "Kewargaan", label: "Kewargaan" },
  { value: "Penalaran Kritis", label: "Penalaran Kritis" },
  { value: "Kreativitas", label: "Kreativitas" },
  { value: "Kolaborasi", label: "Kolaborasi" },
  { value: "Kemandirian", label: "Kemandirian" },
  { value: "Kesehatan", label: "Kesehatan" },
  { value: "Komunikasi", label: "Komunikasi" },
];

export const SEMESTER_OPTIONS: Option[] = [
  { value: "Ganjil", label: "Ganjil" },
  { value: "Genap", label: "Genap" },
];

export const ALOKASI_WAKTU_OPTIONS: Option[] = [
  { value: "1 JP (1 x 35 menit)", label: "1 JP" },
  { value: "2 JP (2 x 35-40 menit)", label: "2 JP" },
  { value: "3 JP", label: "3 JP" },
  { value: "4 JP", label: "4 JP" },
  { value: "2 x Pertemuan", label: "2 Pertemuan" },
  { value: "3 x Pertemuan", label: "3 Pertemuan" },
  { value: "1 Semester", label: "1 Semester" },
];

export function getKelasOptions(jenjang?: string): Option[] {
  const code = normalizeJenjang(jenjang);
  return code ? KELAS_BY_JENJANG[code] || [] : [];
}

export function getMapelOptions(jenjang?: string): Option[] {
  const code = normalizeJenjang(jenjang);
  return code ? (MAPEL_BY_JENJANG[code] || []).map((m) => ({ value: m, label: m })) : [];
}

export function isMapelForJenjang(jenjang: string | null | undefined, mapel: string) {
  return getMapelOptions(jenjang || undefined).some((option) => option.value === mapel);
}

export function getClassMapelOptions(args?: {
  jenjang?: string | null;
  allowedSubjects?: string[] | null;
}) {
  if (!args) return [];
  if (Array.isArray(args.allowedSubjects)) {
    return [...new Set(args.allowedSubjects.map((subject) => subject.trim()).filter(Boolean))].map(
      (subject) => ({ value: subject, label: subject })
    );
  }
  return getMapelOptions(args.jenjang || undefined);
}

export function getAllMapelOptions() {
  return [...new Set(Object.values(MAPEL_BY_JENJANG).flat())].map((subject) => ({
    value: subject,
    label: subject,
  }));
}

/** Resolve dynamic select options based on the current form values. */
export function resolveDynamicOptions(
  source: string,
  formData: Record<string, string>
): Option[] {
  switch (source) {
    case "kelas":
      return getKelasOptions(formData.jenjang);
    case "mapel":
      return getMapelOptions(formData.jenjang);
    case "model":
      return MODEL_PEMBELAJARAN;
    case "alokasi":
      return ALOKASI_WAKTU_OPTIONS;
    case "dpl":
      return DIMENSI_PROFIL_LULUSAN;
    case "semester":
      return SEMESTER_OPTIONS;
    default:
      return [];
  }
}
