export const READING_CATEGORIES = [
  "Literasi",
  "Sastra",
  "Sains",
  "Teknologi",
  "Sejarah",
  "Kebhinnekaan",
  "Karier",
  "Karya Siswa",
] as const;

export function readingStatusLabel(status: string) {
  if (status === "PENDING_REVIEW") return "Menunggu review";
  if (status === "PUBLISHED") return "Terbit";
  if (status === "REJECTED") return "Ditolak";
  if (status === "ARCHIVED") return "Diarsipkan";
  return "Draf";
}
