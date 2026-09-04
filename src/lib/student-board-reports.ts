export const STUDENT_BOARD_REPORT_REASONS = [
  "INAPPROPRIATE",
  "BULLYING",
  "VIOLENCE",
  "SEXUAL_CONTENT",
  "SPAM",
  "PRIVACY",
  "OTHER",
] as const;

export type StudentBoardReportReason =
  (typeof STUDENT_BOARD_REPORT_REASONS)[number];

export const STUDENT_BOARD_REPORT_LABELS: Record<
  StudentBoardReportReason,
  string
> = {
  INAPPROPRIATE: "Konten tidak pantas",
  BULLYING: "Perundungan atau pelecehan",
  VIOLENCE: "Kekerasan atau tindakan berbahaya",
  SEXUAL_CONTENT: "Konten seksual atau pornografi",
  SPAM: "Spam atau menyesatkan",
  PRIVACY: "Pelanggaran privasi",
  OTHER: "Alasan lainnya",
};

export const STUDENT_BOARD_DAILY_REPORT_LIMIT = 20;
