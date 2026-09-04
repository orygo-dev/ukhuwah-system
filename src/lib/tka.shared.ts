export const TKA_SUBJECTS = [
  { slug: "bahasa-indonesia", name: "Bahasa Indonesia", category: "MANDATORY" },
  { slug: "matematika", name: "Matematika", category: "MANDATORY" },
  { slug: "bahasa-inggris", name: "Bahasa Inggris", category: "MANDATORY" },
  { slug: "bahasa-indonesia-tingkat-lanjut", name: "Bahasa Indonesia Tingkat Lanjut", category: "ELECTIVE" },
  { slug: "matematika-tingkat-lanjut", name: "Matematika Tingkat Lanjut", category: "ELECTIVE" },
  { slug: "bahasa-inggris-tingkat-lanjut", name: "Bahasa Inggris Tingkat Lanjut", category: "ELECTIVE" },
  { slug: "fisika", name: "Fisika", category: "ELECTIVE" },
  { slug: "kimia", name: "Kimia", category: "ELECTIVE" },
  { slug: "biologi", name: "Biologi", category: "ELECTIVE" },
  { slug: "ekonomi", name: "Ekonomi", category: "ELECTIVE" },
  { slug: "geografi", name: "Geografi", category: "ELECTIVE" },
  { slug: "sosiologi", name: "Sosiologi", category: "ELECTIVE" },
  { slug: "sejarah", name: "Sejarah", category: "ELECTIVE" },
  { slug: "ppkn", name: "Pendidikan Pancasila", category: "ELECTIVE" },
  { slug: "antropologi", name: "Antropologi", category: "ELECTIVE" },
  { slug: "bahasa-arab", name: "Bahasa Arab", category: "ELECTIVE" },
  { slug: "bahasa-jepang", name: "Bahasa Jepang", category: "ELECTIVE" },
  { slug: "bahasa-jerman", name: "Bahasa Jerman", category: "ELECTIVE" },
  { slug: "bahasa-prancis", name: "Bahasa Prancis", category: "ELECTIVE" },
  { slug: "bahasa-korea", name: "Bahasa Korea", category: "ELECTIVE" },
  { slug: "produk-kreatif-kewirausahaan", name: "Produk Kreatif dan Kewirausahaan", category: "VOCATIONAL" },
  { slug: "projek-kreatif-kewirausahaan", name: "Projek Kreatif dan Kewirausahaan", category: "VOCATIONAL" },
] as const;

export const TKA_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_REVIEW: "Menunggu review",
  APPROVED: "Disetujui",
  PUBLISHED: "Dipublikasikan",
  REJECTED: "Perlu revisi",
  ARCHIVED: "Diarsipkan",
};

export function parseNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => Number.isInteger(item)))].sort(
    (a, b) => a - b
  );
}

export function answersMatch(selected: unknown, correct: unknown) {
  const left = parseNumberArray(selected);
  const right = parseNumberArray(correct);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
