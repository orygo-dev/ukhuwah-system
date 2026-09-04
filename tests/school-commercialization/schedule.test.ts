import assert from "node:assert/strict";
import test from "node:test";
import { findScheduleConflicts, type ScheduleSlotInput } from "../../src/lib/school-schedule";

const slot = (overrides: Partial<ScheduleSlotInput> = {}): ScheduleSlotInput => ({ classRoomId: "class-a", teacherId: "teacher-a", subject: "Matematika", dayOfWeek: 1, periodStart: 1, periodEnd: 2, room: "R1", ...overrides });

test("constraint engine accepts adjacent non-overlapping periods", () => {
  assert.deepEqual(findScheduleConflicts([slot(), slot({ classRoomId: "class-b", teacherId: "teacher-b", room: "R2", periodStart: 3, periodEnd: 4 })]), []);
});

test("constraint engine detects teacher, class, and room collisions", () => {
  const conflicts = findScheduleConflicts([slot(), slot({ subject: "IPA" })]);
  assert.deepEqual(new Set(conflicts.map((item) => item.type)), new Set(["TEACHER", "CLASS", "ROOM"]));
});

test("different days do not collide and invalid ranges are rejected", () => {
  assert.deepEqual(findScheduleConflicts([slot(), slot({ dayOfWeek: 2 })]), []);
  assert.equal(findScheduleConflicts([slot({ periodStart: 4, periodEnd: 3 })])[0]?.type, "INVALID_RANGE");
});
