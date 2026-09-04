import assert from "node:assert/strict";
import test from "node:test";
import { TrackSource } from "livekit-server-sdk";
import {
  canPublishMediaForJoin,
  effectiveLiveKitRoomCapacity,
  isPjjModeratorRole,
  liveKitPublishSourcesForRole,
  pjjCapacityDecision,
} from "../../src/lib/livekit-policy";
import { scoreLiveQuizPercent } from "../../src/lib/pjj-live-quiz";

test("student cannot publish screen share", () => {
  const sources = liveKitPublishSourcesForRole("STUDENT");
  assert.deepEqual(sources, [TrackSource.CAMERA, TrackSource.MICROPHONE]);
  assert.equal(sources.includes(TrackSource.SCREEN_SHARE), false);
});

test("classroom students default to no publish sources until promoted", () => {
  assert.deepEqual(
    liveKitPublishSourcesForRole("STUDENT", {
      roomMode: "CLASSROOM",
      canPublishMedia: false,
    }),
    []
  );
  assert.deepEqual(
    liveKitPublishSourcesForRole("STUDENT", {
      roomMode: "CLASSROOM",
      canPublishMedia: true,
    }),
    [TrackSource.CAMERA, TrackSource.MICROPHONE]
  );
  assert.equal(
    canPublishMediaForJoin({
      role: "STUDENT",
      roomMode: "CLASSROOM",
      canPublishMedia: false,
    }),
    false
  );
});

test("scheduling fails closed above the safe meeting profile", () => {
  assert.deepEqual(pjjCapacityDecision(25, 500, "MEETING"), {
    allowed: true,
    maximum: 25,
  });
  assert.deepEqual(pjjCapacityDecision(26, 500, "MEETING"), {
    allowed: false,
    maximum: 25,
  });
  assert.deepEqual(pjjCapacityDecision(100, 500, "CLASSROOM"), {
    allowed: true,
    maximum: 100,
  });
  assert.deepEqual(pjjCapacityDecision(101, 500, "CLASSROOM"), {
    allowed: false,
    maximum: 100,
  });
});

test("moderator roles can publish presenter sources", () => {
  for (const role of ["TEACHER", "TUTOR", "MODERATOR"] as const) {
    assert.equal(isPjjModeratorRole(role), true);
    assert.equal(liveKitPublishSourcesForRole(role).includes(TrackSource.SCREEN_SHARE), true);
  }
  assert.equal(isPjjModeratorRole("STUDENT"), false);
});

test("room capacity is bounded by platform policy and never below two", () => {
  assert.equal(effectiveLiveKitRoomCapacity(500, 500, "MEETING"), 25);
  assert.equal(effectiveLiveKitRoomCapacity(500, 50, "MEETING"), 25);
  assert.equal(effectiveLiveKitRoomCapacity(25, 50, "MEETING"), 25);
  assert.equal(effectiveLiveKitRoomCapacity(10, 500, "MEETING"), 10);
  assert.equal(effectiveLiveKitRoomCapacity(1, 50, "MEETING"), 2);
  assert.equal(effectiveLiveKitRoomCapacity(500, 500, "CLASSROOM"), 100);
  assert.equal(effectiveLiveKitRoomCapacity(80, 500, "CLASSROOM"), 80);
});

test("live quiz score uses percentage of total points", () => {
  assert.equal(
    scoreLiveQuizPercent(
      [
        { isCorrect: true, points: 2 },
        { isCorrect: false, points: 2 },
        { isCorrect: true, points: 1 },
      ],
      5
    ),
    60
  );
  assert.equal(scoreLiveQuizPercent([], 0), 0);
});
