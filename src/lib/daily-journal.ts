import type { DocumentStatus } from "@prisma/client";
import { formatDateId, parseDateOnly, todayDateString } from "@/lib/attendance";

export const JOURNAL_STATUS_OPTIONS: {
  value: DocumentStatus;
  label: string;
  color: string;
}[] = [
  { value: "DRAFT", label: "Draft", color: "bg-slate-100 text-slate-700" },
  { value: "FINAL", label: "Final", color: "bg-emerald-100 text-emerald-800" },
];

export function journalStatusLabel(status: DocumentStatus): string {
  return JOURNAL_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export { formatDateId, parseDateOnly, todayDateString };

export type JournalSummary = {
  total: number;
  draft: number;
  final: number;
  todayCount: number;
};
