export const ASSIGNMENT_TIME_ZONE = "Asia/Jakarta";
export const ASSIGNMENT_TIME_ZONE_LABEL = "WIB";
export const DEFAULT_ASSIGNMENT_DUE_TIME = "23:59";

const LOCAL_DEADLINE_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

export function parseAssignmentDueAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const match = LOCAL_DEADLINE_PATTERN.exec(value.trim());
  if (!match) throw new Error("Format deadline harus tanggal dan jam yang valid.");
  const date = new Date(`${match[1]}T${match[2]}:${match[3]}:00.000+07:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Deadline tidak valid.");
  return date;
}

export function assignmentDueAtFromLegacyDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const datePart = typeof value === "string"
    ? value.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(value);
  return new Date(`${datePart}T${DEFAULT_ASSIGNMENT_DUE_TIME}:59.000+07:00`);
}

export function effectiveAssignmentDueAt(input: {
  dueAt?: Date | string | null;
  dueDate?: Date | string | null;
}): Date | null {
  if (input.dueAt) return new Date(input.dueAt);
  return assignmentDueAtFromLegacyDate(input.dueDate);
}

export function legacyDateFromDueAt(value: Date | null): Date | null {
  if (!value) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASSIGNMENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  const [year, month, day] = parts.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function assignmentDeadlineState(input: {
  dueAt?: Date | string | null;
  dueDate?: Date | string | null;
  submissionClosedAt?: Date | string | null;
  allowLate: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dueAt = effectiveAssignmentDueAt(input);
  const manuallyClosed = Boolean(input.submissionClosedAt);
  const overdue = Boolean(dueAt && now.getTime() > dueAt.getTime());
  return {
    dueAt,
    overdue,
    manuallyClosed,
    acceptsSubmission: !manuallyClosed && (!overdue || input.allowLate),
    isLate: overdue,
  };
}

export function formatAssignmentDueAt(value: Date | string | null | undefined) {
  if (!value) return "Tanpa deadline";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: ASSIGNMENT_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(value));
}
