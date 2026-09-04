import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPersistedChat,
  markChatFailed,
  mergeChatHistory,
  settlePendingChat,
  type PjjChatItem,
} from "../../src/lib/pjj-chat-state";
import {
  applyWhiteboardDelta,
  hydrateWhiteboardState,
  PJJ_WHITEBOARD_MAX_STROKES,
  type PjjWhiteboardStroke,
} from "../../src/lib/pjj-whiteboard-state";
import {
  nextConnectionHealth,
  pjjDiagnosticBatchSchema,
  safeDiagnosticReason,
} from "../../src/lib/pjj-telemetry";
import {
  cancelLiveSessionWithProvider,
  closeProviderRoomForCancellation,
} from "../../src/lib/pjj-session-lifecycle";
import { PJJ_WEB_ROOM_OPTIONS } from "../../src/lib/pjj-room-options";

function chat(id: string): PjjChatItem {
  return {
    id,
    body: id,
    senderName: "Test",
    senderIdentity: "user:test",
    createdAt: "2026-08-12T00:00:00.000Z",
  };
}

function stroke(id: string): PjjWhiteboardStroke {
  return { id, color: "#fff", width: 3, erase: false, points: [[0, 0], [1, 1]] };
}

test("chat replay, dedupe, failure, retry settlement, and 5k window remain bounded", () => {
  let state: PjjChatItem[] = [];
  for (let index = 0; index < 5000; index += 1) state = appendPersistedChat(state, chat(`m${index}`));
  assert.equal(state.length, 200);
  assert.equal(appendPersistedChat(state, chat("m4999")), state);

  const pending = { ...chat("pending:client-1"), status: "pending" as const };
  state = [...state, pending].slice(-200);
  state = markChatFailed(state, pending.id);
  assert.equal(state.at(-1)?.status, "failed");
  state = settlePendingChat(state, pending.id, chat("db-1"));
  assert.equal(state.some((item) => item.id === pending.id), false);
  assert.equal(state.at(-1)?.id, "db-1");

  const replay = mergeChatHistory([pending], [chat("db-2"), chat("db-3")]);
  assert.deepEqual(replay.map((item) => item.id), ["db-2", "db-3", pending.id]);
});

test("whiteboard late join, missed delta, clear, dedupe, and 10k strokes are deterministic", () => {
  let state = { version: 0, strokes: [] as PjjWhiteboardStroke[] };
  for (let sequence = 1; sequence <= 10_000; sequence += 1) {
    state = applyWhiteboardDelta(state, { sequence, kind: "stroke", stroke: stroke(`s${sequence}`) });
  }
  assert.equal(state.strokes.length, PJJ_WHITEBOARD_MAX_STROKES);
  assert.equal(state.version, 10_000);
  const same = applyWhiteboardDelta(state, { sequence: 10_000, kind: "stroke", stroke: stroke("duplicate") });
  assert.equal(same, state);

  const recovered = hydrateWhiteboardState(
    { version: 100, strokes: [stroke("snapshot")] },
    [
      { sequence: 102, kind: "stroke", stroke: stroke("after") },
      { sequence: 101, kind: "clear" },
    ]
  );
  assert.deepEqual(recovered.strokes.map((item) => item.id), ["after"]);
  assert.equal(recovered.version, 102);
});

test("connection reducer recovers without creating a new room state", () => {
  assert.deepEqual(PJJ_WEB_ROOM_OPTIONS, { adaptiveStream: true, dynacast: true });
  assert.equal(Object.isFrozen(PJJ_WEB_ROOM_OPTIONS), true);
  let state = nextConnectionHealth("connected", "reconnecting");
  assert.equal(state, "reconnecting");
  state = nextConnectionHealth(state, "reconnected");
  assert.equal(state, "restored");
  assert.equal(nextConnectionHealth("unstable", "good"), "restored");
  assert.equal(nextConnectionHealth("connected", "disconnected"), "disconnected");
});

test("diagnostic schema covers required signals and redacts credential-shaped reasons", () => {
  const base = {
    occurredAt: "2026-08-12T00:00:00.000Z",
    clientSessionId: "00000000-0000-4000-8000-000000000001",
  };
  const events = [
    "connection.connect_attempt",
    "connection.connected",
    "connection.reconnecting",
    "connection.reconnected",
    "connection.disconnected",
    "track.publish_failed",
    "track.subscription_failed",
    "audio.playback_failed",
    "media.permission_denied",
    "participant.count",
    "connection.quality",
  ].map((event) => ({ ...base, event }));
  assert.equal(pjjDiagnosticBatchSchema.safeParse({ events }).success, true);
  assert.equal(safeDiagnosticReason("Authorization eyJabcdefghijk.abc.signature"), "redacted");
});

test("cancel helper closes only live rooms and propagates provider failure", async () => {
  const calls: string[] = [];
  await closeProviderRoomForCancellation(
    { roomName: "room-live", status: "LIVE", actualStart: new Date() },
    async (room) => calls.push(room)
  );
  await closeProviderRoomForCancellation(
    { roomName: "room-scheduled", status: "SCHEDULED", actualStart: null },
    async (room) => calls.push(room)
  );
  assert.deepEqual(calls, ["room-live"]);
  await assert.rejects(
    closeProviderRoomForCancellation(
      { roomName: "room-fail", status: "LIVE", actualStart: new Date() },
      async () => {
        throw new Error("provider unavailable");
      }
    ),
    /provider unavailable/
  );
});

test("cancel blocks token issuance in DB before deleting provider room", async () => {
  const order: string[] = [];
  const result = await cancelLiveSessionWithProvider(
    { roomName: "room-live", status: "LIVE", actualStart: new Date() },
    async () => {
      order.push("db-cancelled");
      return { status: "CANCELLED" };
    },
    async () => {
      order.push("provider-deleted");
    }
  );
  assert.deepEqual(order, ["db-cancelled", "provider-deleted"]);
  assert.equal(result.status, "CANCELLED");
});
