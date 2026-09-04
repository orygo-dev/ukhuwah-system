import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeRoomData,
  encodeRoomData,
  isAuthorizedRoomDataMessage,
  isRoomModerator,
  isTrustedPersistedChat,
} from "../../src/components/pjj/room/live-room-data";

test("decodes a valid bounded chat packet", () => {
  const packet = encodeRoomData({
    type: "chat:message",
    id: "m1",
    body: "halo",
    senderName: "Payload name",
    senderIdentity: "payload-id",
    createdAt: "2026-08-11T00:00:00.000Z",
  });
  assert.equal(decodeRoomData(packet)?.type, "chat:message");
});

test("rejects unknown, malformed, oversized, and out-of-bounds payloads", () => {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  assert.equal(decodeRoomData(encode({ type: "mod:root" })), null);
  assert.equal(decodeRoomData(encode({ type: "chat:message", body: "missing fields" })), null);
  assert.equal(
    decodeRoomData(
      encode({
        type: "wb:stroke",
        stroke: { id: "x", color: "#fff", width: 3, erase: false, points: [[-1, 2], [0, 0]] },
      })
    ),
    null
  );
  assert.equal(decodeRoomData(new Uint8Array(15 * 1024 + 1)), null);
});

test("moderator authority comes from signed participant metadata", () => {
  assert.equal(
    isRoomModerator({ identity: "user:teacher", metadata: JSON.stringify({ role: "TEACHER" }) }),
    true
  );
  assert.equal(
    isRoomModerator({ identity: "user:student", metadata: JSON.stringify({ role: "STUDENT" }) }),
    false
  );
  assert.equal(isRoomModerator({ identity: "user:bad", metadata: "not-json" }), false);
});

test("student cannot forge any moderator-only command", () => {
  const student = { identity: "user:student", metadata: JSON.stringify({ role: "STUDENT" }) };
  const teacher = { identity: "user:teacher", metadata: JSON.stringify({ role: "TEACHER" }) };
  const commands = [
    { type: "wb:clear", by: "user:teacher" },
    { type: "q:update", questionId: "q1", status: "ANSWERED" },
    { type: "att:refresh" },
    { type: "mod:request_unmute", targetIdentity: "user:victim", byName: "Teacher" },
    { type: "mod:muted", targetIdentity: "user:victim" },
  ];
  for (const command of commands) {
    const message = decodeRoomData(new TextEncoder().encode(JSON.stringify(command)));
    assert.notEqual(message, null);
    assert.equal(isAuthorizedRoomDataMessage(message, student), false);
    assert.equal(isAuthorizedRoomDataMessage(message, teacher), true);
  }
});

test("spoofable legacy chat identity is never authoritative", () => {
  const packet = encodeRoomData({
    type: "chat:message",
    id: "forged",
    body: "Saya guru",
    senderName: "Guru",
    senderIdentity: "user:teacher",
    createdAt: "2026-08-12T00:00:00.000Z",
  });
  const message = decodeRoomData(packet);
  assert.equal(
    isAuthorizedRoomDataMessage(message, {
      identity: "user:student",
      metadata: JSON.stringify({ role: "STUDENT" }),
    }),
    false
  );
});

test("persisted chat is trusted only when broadcast by RoomService", () => {
  const message = decodeRoomData(
    encodeRoomData({
      type: "chat:persisted",
      id: "db-id",
      body: "authoritative",
      senderName: "Teacher",
      senderIdentity: "user:teacher",
      createdAt: "2026-08-11T00:00:00.000Z",
    })
  );
  assert.equal(isTrustedPersistedChat(message, undefined), true);
  assert.equal(
    isTrustedPersistedChat(message, {
      identity: "user:student",
      metadata: JSON.stringify({ role: "STUDENT" }),
    }),
    false
  );
});
