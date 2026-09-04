import type { UserRole } from "@prisma/client";

export const STUDENT_SPOTLIGHT_REPORT_REASONS = [
  "INAPPROPRIATE",
  "BULLYING",
  "VIOLENCE",
  "SEXUAL_CONTENT",
  "SPAM",
  "PRIVACY",
  "OTHER",
] as const;

export type StudentSpotlightReportReason =
  (typeof STUDENT_SPOTLIGHT_REPORT_REASONS)[number];

export const STUDENT_SPOTLIGHT_REPORT_LABELS: Record<
  StudentSpotlightReportReason,
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

export const SPOTLIGHT_AUTO_HIDE_REPORT_COUNT = 3;
export const SPOTLIGHT_DAILY_REPORT_LIMIT = 20;

export function canModerateStudentSpotlightReports(role: UserRole) {
  return ["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(role);
}
