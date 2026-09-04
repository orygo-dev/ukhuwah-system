import type { AssessmentType } from "@prisma/client";

export const ASSESSMENT_TYPE_OPTIONS: {
  value: AssessmentType;
  label: string;
}[] = [
  { value: "QUIZ", label: "Kuis / ULH" },
  { value: "TUGAS", label: "Tugas" },
  { value: "UTS", label: "UTS" },
  { value: "UAS", label: "UAS" },
  { value: "PROYEK", label: "Proyek" },
  { value: "LAINNYA", label: "Lainnya" },
];

export function assessmentTypeLabel(type: AssessmentType): string {
  return ASSESSMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

export function scoreToPredikat(score: number, maxScore: number): string {
  if (maxScore <= 0) return "—";
  const pct = (score / maxScore) * 100;
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "E";
}

export function formatScore(score: number | null | undefined, maxScore: number): string {
  if (score == null) return "—";
  return `${score}/${maxScore}`;
}

export type StudentGradeSummary = {
  studentId: string;
  nis: string | null;
  name: string;
  scores: {
    assessmentId: string;
    title: string;
    mapel?: string;
    type?: string;
    score: number | null;
    maxScore: number;
  }[];
  average: number | null;
  gradedCount: number;
  totalAssessments: number;
};
