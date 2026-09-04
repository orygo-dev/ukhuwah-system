export type ScheduleSlotInput = {
  id?: string;
  classRoomId: string;
  teacherId: string;
  subject: string;
  dayOfWeek: number;
  periodStart: number;
  periodEnd: number;
  room?: string | null;
};

export type ScheduleConflict = {
  type: "TEACHER" | "CLASS" | "ROOM" | "INVALID_RANGE";
  indexes: number[];
  message: string;
};

function overlaps(a: ScheduleSlotInput, b: ScheduleSlotInput) {
  return a.dayOfWeek === b.dayOfWeek && a.periodStart <= b.periodEnd && b.periodStart <= a.periodEnd;
}

export function findScheduleConflicts(slots: ScheduleSlotInput[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  slots.forEach((slot, index) => {
    if (
      !Number.isInteger(slot.dayOfWeek) ||
      slot.dayOfWeek < 1 ||
      slot.dayOfWeek > 7 ||
      !Number.isInteger(slot.periodStart) ||
      !Number.isInteger(slot.periodEnd) ||
      slot.periodStart < 1 ||
      slot.periodEnd < slot.periodStart
    ) {
      conflicts.push({ type: "INVALID_RANGE", indexes: [index], message: "Rentang hari/jam tidak valid." });
    }
  });

  for (let left = 0; left < slots.length; left += 1) {
    for (let right = left + 1; right < slots.length; right += 1) {
      const a = slots[left];
      const b = slots[right];
      if (!overlaps(a, b)) continue;
      if (a.teacherId === b.teacherId) {
        conflicts.push({ type: "TEACHER", indexes: [left, right], message: "Guru terjadwal di dua tempat pada waktu yang sama." });
      }
      if (a.classRoomId === b.classRoomId) {
        conflicts.push({ type: "CLASS", indexes: [left, right], message: "Kelas memiliki dua pelajaran pada waktu yang sama." });
      }
      if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
        conflicts.push({ type: "ROOM", indexes: [left, right], message: "Ruang digunakan oleh dua kelas pada waktu yang sama." });
      }
    }
  }
  return conflicts;
}

export function assertConflictFreeSchedule(slots: ScheduleSlotInput[]) {
  const conflicts = findScheduleConflicts(slots);
  if (conflicts.length > 0) {
    const error = new Error("SCHEDULE_CONFLICT");
    Object.assign(error, { conflicts });
    throw error;
  }
}
