import assert from "node:assert/strict";
import test from "node:test";
import { liveAttendanceFromDuration } from "../../src/lib/pjj";

const scheduledStart = new Date("2026-08-11T01:00:00.000Z");
const scheduledEnd = new Date("2026-08-11T02:00:00.000Z");

test("attendance duration is capped and classified", () => {
  assert.deepEqual(
    liveAttendanceFromDuration({
      totalSeconds: 3600,
      scheduledStart,
      scheduledEnd,
      firstJoinedAt: scheduledStart,
      minPercent: 70,
    }),
    { status: "PRESENT", percent: 100 }
  );
  assert.deepEqual(
    liveAttendanceFromDuration({
      totalSeconds: 1800,
      scheduledStart,
      scheduledEnd,
      firstJoinedAt: scheduledStart,
      minPercent: 70,
    }),
    { status: "PARTIAL", percent: 50 }
  );
});

test("late arrival is preserved once minimum duration is reached", () => {
  const result = liveAttendanceFromDuration({
    totalSeconds: 3000,
    scheduledStart,
    scheduledEnd,
    firstJoinedAt: new Date("2026-08-11T01:16:00.000Z"),
    minPercent: 70,
  });
  assert.equal(result.status, "LATE");
});

