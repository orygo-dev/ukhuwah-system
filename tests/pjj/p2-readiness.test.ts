import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { z } from "zod";
import {
  acquirePreviewMedia,
  classifyPreviewDeviceError,
} from "../../src/lib/pjj-media-preview";
import { createSingleFlightRunner } from "../../src/lib/pjj-single-flight";
import { classifyPjjApiError } from "../../src/lib/pjj-api-errors";
import {
  canSelectAudioOutput,
  PJJ_CONTROL_BAR_CONTROLS,
} from "../../src/lib/pjj-conference-controls";

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

test("lobby acquires mic and camera independently and preserves partial success", async () => {
  let stopped = 0;
  const audioTrack = { kind: "audio", stop: () => (stopped += 1) };
  const calls: MediaStreamConstraints[] = [];
  const result = await acquirePreviewMedia({
    audio: true,
    video: true,
    getUserMedia: async (constraints) => {
      calls.push(constraints);
      if (constraints.video) throw namedError("NotAllowedError");
      return {
        getAudioTracks: () => [audioTrack],
        getVideoTracks: () => [],
      };
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(result.audio, "ready");
  assert.equal(result.video, "denied");
  assert.deepEqual(result.tracks, [audioTrack]);
  result.tracks.forEach((track) => track.stop());
  assert.equal(stopped, 1);
});

test("lobby maps browser device failures to actionable states", () => {
  assert.equal(classifyPreviewDeviceError(namedError("NotAllowedError")), "denied");
  assert.equal(classifyPreviewDeviceError(namedError("NotFoundError")), "missing");
  assert.equal(classifyPreviewDeviceError(namedError("NotReadableError")), "busy");
  assert.equal(classifyPreviewDeviceError(namedError("OverconstrainedError")), "unsupported");
  assert.equal(classifyPreviewDeviceError(new Error("other")), "error");
});

test("polling runner is single-flight and aborts resource ownership on cleanup", async () => {
  const runner = createSingleFlightRunner();
  let release!: () => void;
  let ownedSignal: AbortSignal | undefined;
  const first = runner.run(
    (signal) =>
      new Promise<string>((resolve) => {
        ownedSignal = signal;
        release = () => resolve("done");
      })
  );
  assert.equal(runner.running, true);
  assert.deepEqual(await runner.run(async () => "stale"), { status: "skipped" });
  runner.stop();
  assert.equal(ownedSignal?.aborted, true);
  release();
  assert.deepEqual(await first, { status: "aborted" });

  const reusable = createSingleFlightRunner();
  assert.deepEqual(await reusable.run(async () => 1), { status: "success", value: 1 });
  assert.deepEqual(await reusable.run(async () => 2), { status: "success", value: 2 });
});

test("API error taxonomy separates validation, transient, provider, and fatal errors", () => {
  const messages = { validationMessage: "invalid", fallbackMessage: "failed" };
  assert.deepEqual(classifyPjjApiError(z.object({ id: z.string() }).safeParse({}).error, messages).body, {
    error: "invalid",
    code: "VALIDATION",
    retryable: false,
  });
  const prismaFailure = Object.assign(new Error("database offline"), { code: "P1001" });
  assert.equal(classifyPjjApiError(prismaFailure, messages).status, 503);
  const liveKitFailure = new Error("LiveKit room service rejected request");
  assert.equal(classifyPjjApiError(liveKitFailure, messages).body.code, "DEGRADED");
  const fatal = classifyPjjApiError(new Error("internal row detail secret=abc"), messages);
  assert.equal(fatal.status, 500);
  assert.equal(fatal.body.error, "failed");
  assert.equal(fatal.body.error.includes("secret"), false);
});

test("web conference exposes one persistent chat surface and feature-detects speaker output", () => {
  assert.equal(PJJ_CONTROL_BAR_CONTROLS.chat, false);
  assert.equal(canSelectAudioOutput({ setSinkId() {} }), true);
  assert.equal(canSelectAudioOutput({}), false);
  const source = readFileSync("src/components/pjj/live-class-room-client.tsx", "utf8");
  assert.equal(source.includes("<VideoConference"), false);
  assert.equal(source.includes("<LiveChatPanel"), true);
  assert.match(source, /controls=\{PJJ_CONTROL_BAR_CONTROLS\}/);
  assert.match(source, /RoomEvent\.TrackMuted/);
  assert.match(source, /RoomEvent\.TrackUnmuted/);
});

test("teacher PJJ UI defaults to the shared 25-participant safe cap", () => {
  const source = readFileSync("src/components/pjj/teacher-pjj-client.tsx", "utf8");
  assert.match(source, /PJJ_SAFE_MEETING_MAX_PARTICIPANTS/);
  assert.match(source, /PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS/);
  assert.equal(source.includes("useState(50)"), false);
  assert.equal(source.includes("maxParticipants: 50"), false);
});

test("LiveKit configuration and scheduling APIs share mode-aware capacity caps", () => {
  const liveKit = readFileSync("src/lib/livekit.ts", "utf8");
  const adminApi = readFileSync("src/app/api/admin/livekit/route.ts", "utf8");
  const sessionsApi = readFileSync("src/app/api/pjj/sessions/route.ts", "utf8");
  const capacity = readFileSync("src/lib/pjj-capacity.ts", "utf8");

  assert.match(capacity, /PJJ_SAFE_MEETING_MAX_PARTICIPANTS = 25/);
  assert.match(capacity, /PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS = 100/);
  assert.match(liveKit, /PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS/);
  assert.match(adminApi, /PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS/);
  assert.match(sessionsApi, /pjjSafeMaxForRoomMode|CLASSROOM/);
});

test("notification polling treats cleanup abort as normal and avoids stale loading updates", () => {
  const source = readFileSync(
    "src/components/notifications/notification-bell.tsx",
    "utf8",
  );
  assert.match(source, /error\.name === "AbortError"/);
  assert.match(source, /if \(!signal\?\.aborted\) setLoading\(false\)/);
});
