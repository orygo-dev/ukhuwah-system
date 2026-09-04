import type { AttendanceStatus } from "@prisma/client";

export const ATTENDANCE_STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
  short: string;
  color: string;
}[] = [
  { value: "PRESENT", label: "Hadir", short: "H", color: "bg-emerald-100 text-emerald-800" },
  { value: "EXCUSED", label: "Izin", short: "I", color: "bg-amber-100 text-amber-800" },
  { value: "SICK", label: "Sakit", short: "S", color: "bg-emerald-100 text-emerald-800" },
  { value: "ABSENT", label: "Alpha", short: "A", color: "bg-red-100 text-red-800" },
];

export function attendanceStatusLabel(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

export function attendanceStatusShort(status: AttendanceStatus): string {
  return ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === status)?.short ?? "?";
}

export function todayDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateId(value: string | Date): string {
  const date = typeof value === "string" ? parseDateOnly(value.slice(0, 10)) : value;
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type AttendanceSummary = {
  present: number;
  excused: number;
  sick: number;
  absent: number;
  total: number;
};

export function summarizeStatuses(
  statuses: AttendanceStatus[]
): AttendanceSummary {
  const summary: AttendanceSummary = {
    present: 0,
    excused: 0,
    sick: 0,
    absent: 0,
    total: statuses.length,
  };
  for (const s of statuses) {
    if (s === "PRESENT") summary.present++;
    else if (s === "EXCUSED") summary.excused++;
    else if (s === "SICK") summary.sick++;
    else if (s === "ABSENT") summary.absent++;
  }
  return summary;
}
