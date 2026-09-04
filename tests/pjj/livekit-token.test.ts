import assert from "node:assert/strict";
import test from "node:test";
import {
  issuePjjJoinToken,
  liveClassParticipantRosterMutation,
} from "../../src/lib/pjj-livekit-token";

const config = {
  apiKey: "test-key",
  apiSecret: "test-secret-with-enough-length",
  wsUrl: "wss://livekit.invalid",
  maxParticipants: 500,
};

function jwtPayload(jwt: string) {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as {
    video: {
      room?: string;
      roomJoin?: boolean;
      canPublish?: boolean;
      canPublishSources?: string[];
      canSubscribe?: boolean;
      canPublishData?: boolean;
      roomAdmin?: boolean;
      canUpdateOwnMetadata?: boolean;
    };
    roomConfig?: { maxParticipants?: number };
  };
}

test("token-only roster mutation cannot create phantom join state", () => {
  const mutation = liveClassParticipantRosterMutation({
    sessionId: "session-1",
    userId: "user-1",
    studentId: "student-1",
    role: "STUDENT",
  });
  for (const data of [mutation.create, mutation.update]) {
    assert.equal("firstJoinedAt" in data, false);
    assert.equal("lastJoinedAt" in data, false);
    assert.equal("lastLeftAt" in data, false);
    assert.equal("joinCount" in data, false);
    assert.equal("liveKitParticipantSid" in data, false);
  }
});

test("actual student JWT excludes screen-share sources and admin grant", async () => {
  const result = await issuePjjJoinToken(
    {
      identity: "user:student-1",
      name: "Student",
      roomName: "pjj-test",
      role: "STUDENT",
      maxParticipants: 500,
    },
    config
  );
  const claims = jwtPayload(result.token);
  assert.equal(claims.video.roomJoin, true);
  assert.equal(claims.video.canPublish, true);
  assert.equal(claims.video.roomAdmin, false);
  assert.notEqual(claims.video.canUpdateOwnMetadata, true);
  assert.deepEqual(claims.video.canPublishSources, ["camera", "microphone"]);
  assert.equal(claims.video.canPublishSources?.includes("screen_share"), false);
  assert.equal(claims.video.canPublishSources?.includes("screen_share_audio"), false);
});

test("actual moderator JWT has presenter grants and room is hard-capped to safe profile", async () => {
  const result = await issuePjjJoinToken(
    {
      identity: "user:teacher-1",
      name: "Teacher",
      roomName: "pjj-test",
      role: "TEACHER",
      maxParticipants: 500,
    },
    config
  );
  const claims = jwtPayload(result.token);
  assert.equal(claims.video.roomAdmin, true);
  assert.equal(claims.video.canPublishSources?.includes("screen_share"), true);
  assert.equal(claims.roomConfig?.maxParticipants, 25);
});

test("classroom spectator JWT cannot publish media", async () => {
  const result = await issuePjjJoinToken(
    {
      identity: "user:student-2",
      name: "Student",
      roomName: "pjj-classroom",
      role: "STUDENT",
      maxParticipants: 100,
      roomMode: "CLASSROOM",
      canPublishMedia: false,
    },
    config
  );
  const claims = jwtPayload(result.token);
  assert.equal(claims.video.canPublish, false);
  assert.deepEqual(claims.video.canPublishSources || [], []);
  assert.equal(claims.video.canPublishData, true);
  assert.equal(claims.video.canSubscribe, true);
  assert.equal(claims.roomConfig?.maxParticipants, 100);
});

test("classroom promoted student JWT can publish camera and mic", async () => {
  const result = await issuePjjJoinToken(
    {
      identity: "user:student-3",
      name: "Student",
      roomName: "pjj-classroom",
      role: "STUDENT",
      maxParticipants: 100,
      roomMode: "CLASSROOM",
      canPublishMedia: true,
    },
    config
  );
  const claims = jwtPayload(result.token);
  assert.equal(claims.video.canPublish, true);
  assert.deepEqual(claims.video.canPublishSources, ["camera", "microphone"]);
});
