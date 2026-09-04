import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  processPjjWebhookEvent,
  type PjjWebhookEvent,
} from "../../src/lib/pjj-livekit-webhook";

type ParticipantState = {
  id: string;
  sessionId: string;
  userId: string;
  studentId: string | null;
  firstJoinedAt: Date | null;
  lastJoinedAt: Date | null;
  lastLeftAt: Date | null;
  liveKitParticipantSid: string | null;
  totalSeconds: number;
  joinCount: number;
  attendanceStatus: "NEEDS_REVIEW" | "PRESENT" | "LATE" | "PARTIAL" | "ABSENT";
};

type Store = {
  receipts: Set<string>;
  participant: ParticipantState;
  attendanceWrites: number;
};

const session = {
  id: "session-1",
  roomName: "room-1",
  status: "SCHEDULED",
  actualStart: null,
  actualEnd: null,
  scheduledStart: new Date("2026-08-12T00:00:00.000Z"),
  scheduledEnd: new Date("2026-08-12T01:00:00.000Z"),
  minAttendancePercent: 70,
  attendanceSessionId: "attendance-1",
};

function initialStore(): Store {
  return {
    receipts: new Set(),
    participant: {
      id: "participant-1",
      sessionId: session.id,
      userId: "user-1",
      studentId: "student-1",
      firstJoinedAt: null,
      lastJoinedAt: null,
      lastLeftAt: null,
      liveKitParticipantSid: null,
      totalSeconds: 0,
      joinCount: 0,
      attendanceStatus: "NEEDS_REVIEW",
    },
    attendanceWrites: 0,
  };
}

function joined(id: string, seconds: number, sid = "PA_1"): PjjWebhookEvent {
  return {
    id,
    event: "participant_joined",
    createdAt: seconds,
    room: { name: session.roomName },
    participant: { identity: "user:user-1", sid },
  };
}

function left(id: string, seconds: number, sid = "PA_1"): PjjWebhookEvent {
  return {
    id,
    event: "participant_left",
    createdAt: seconds,
    room: { name: session.roomName },
    participant: { identity: "user:user-1", sid },
  };
}

function createHarness() {
  let store = initialStore();
  let failNextParticipantWrite = false;
  let tail: Promise<unknown> = Promise.resolve();

  const transaction = <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => {
    const task = tail.then(async () => {
      const draft = structuredClone(store);
      const tx = {
        liveKitWebhookEvent: {
          create: async ({ data }: { data: { id: string } }) => {
            if (draft.receipts.has(data.id)) {
              throw Object.assign(new Error("duplicate"), { code: "P2002" });
            }
            draft.receipts.add(data.id);
            return data;
          },
        },
        liveClassSession: {
          findUnique: async () => structuredClone(session),
          update: async () => structuredClone(session),
        },
        liveClassParticipant: {
          findUnique: async () => structuredClone(draft.participant),
          updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
            if (failNextParticipantWrite) {
              failNextParticipantWrite = false;
              throw new Error("injected participant write failure");
            }
            const current = draft.participant;
            if (where.id !== current.id) return { count: 0 };
            if ("lastJoinedAt" in where) {
              const expected = where.lastJoinedAt as Date | null;
              if (expected?.getTime() !== current.lastJoinedAt?.getTime()) return { count: 0 };
              if (expected === null && current.lastJoinedAt !== null) return { count: 0 };
            }
            if (
              "liveKitParticipantSid" in where &&
              where.liveKitParticipantSid !== current.liveKitParticipantSid
            ) {
              return { count: 0 };
            }
            if (Array.isArray(where.OR)) {
              const canJoin =
                current.lastLeftAt === null ||
                current.lastLeftAt < ((where.OR[1] as { lastLeftAt: { lt: Date } }).lastLeftAt.lt);
              if (!canJoin) return { count: 0 };
            }
            for (const [key, value] of Object.entries(data)) {
              if (typeof value === "object" && value && "increment" in value) {
                const field = key as "totalSeconds" | "joinCount";
                current[field] += (value as { increment: number }).increment;
              } else {
                (current as unknown as Record<string, unknown>)[key] = value;
              }
            }
            return { count: 1 };
          },
        },
        attendanceRecord: {
          upsert: async () => {
            draft.attendanceWrites += 1;
            return {};
          },
        },
      } as unknown as Prisma.TransactionClient;
      const result = await operation(tx);
      store = draft;
      return result;
    });
    tail = task.catch(() => undefined);
    return task;
  };

  return {
    transaction,
    state: () => store,
    failNextWrite: () => {
      failNextParticipantWrite = true;
    },
  };
}

test("receipt rolls back with failed side effect and retry completes exactly once", async () => {
  const harness = createHarness();
  harness.failNextWrite();
  await assert.rejects(
    processPjjWebhookEvent(joined("event-1", 1_786_492_800), harness.transaction),
    /injected/
  );
  assert.equal(harness.state().receipts.has("event-1"), false);
  assert.equal(harness.state().participant.joinCount, 0);

  await processPjjWebhookEvent(joined("event-1", 1_786_492_800), harness.transaction);
  assert.equal(harness.state().receipts.has("event-1"), true);
  assert.equal(harness.state().participant.joinCount, 1);
});

test("concurrent duplicate event commits one receipt and one side effect", async () => {
  const harness = createHarness();
  const event = joined("event-concurrent", 1_786_492_800);
  const results = await Promise.allSettled([
    processPjjWebhookEvent(event, harness.transaction),
    processPjjWebhookEvent(event, harness.transaction),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  assert.equal(harness.state().participant.joinCount, 1);
});

test("aborted connection never marks roster online", async () => {
  const harness = createHarness();
  await processPjjWebhookEvent(
    {
      id: "event-aborted",
      event: "participant_connection_aborted",
      createdAt: 1_786_492_800,
      room: { name: session.roomName },
      participant: { identity: "user:user-1", sid: "PA_ABORT" },
    },
    harness.transaction
  );
  assert.equal(harness.state().participant.lastJoinedAt, null);
  assert.equal(harness.state().participant.joinCount, 0);
});

test("same-SID replay and stale leave are idempotent", async () => {
  const harness = createHarness();
  await processPjjWebhookEvent(joined("join-1", 1_786_492_800), harness.transaction);
  await processPjjWebhookEvent(joined("join-replay", 1_786_492_801), harness.transaction);
  await processPjjWebhookEvent(left("leave-stale", 1_786_492_799), harness.transaction);
  assert.equal(harness.state().participant.joinCount, 1);
  assert.equal(harness.state().participant.liveKitParticipantSid, "PA_1");
  assert.notEqual(harness.state().participant.lastJoinedAt, null);
});

test("old duplicate-identity SID cannot close replacement connection", async () => {
  const harness = createHarness();
  const base = 1_786_492_800;
  await processPjjWebhookEvent(joined("join-a", base, "PA_A"), harness.transaction);
  await processPjjWebhookEvent(joined("join-b", base + 10, "PA_B"), harness.transaction);
  await processPjjWebhookEvent(left("leave-a", base + 20, "PA_A"), harness.transaction);
  assert.equal(harness.state().participant.liveKitParticipantSid, "PA_B");
  assert.notEqual(harness.state().participant.lastJoinedAt, null);

  await processPjjWebhookEvent(left("leave-b", base + 30, "PA_B"), harness.transaction);
  assert.equal(harness.state().participant.lastJoinedAt, null);
  assert.equal(harness.state().participant.liveKitParticipantSid, null);
  assert.equal(harness.state().participant.joinCount, 2);
  assert.equal(harness.state().participant.totalSeconds, 30);
  assert.equal(harness.state().attendanceWrites, 1);
});

test("delayed old-SID join never rewinds a replacement interval", async () => {
  const harness = createHarness();
  const base = 1_786_492_800;
  await processPjjWebhookEvent(joined("new-join", base + 20, "PA_NEW"), harness.transaction);
  await processPjjWebhookEvent(joined("old-delayed", base, "PA_OLD"), harness.transaction);
  assert.equal(harness.state().participant.liveKitParticipantSid, "PA_NEW");
  assert.equal(harness.state().participant.joinCount, 1);
  assert.equal(harness.state().participant.lastJoinedAt?.getTime(), (base + 20) * 1000);
});

test("uncorrelated leave cannot close an interval that has a known SID", async () => {
  const harness = createHarness();
  const base = 1_786_492_800;
  await processPjjWebhookEvent(joined("new-join", base, "PA_NEW"), harness.transaction);
  await processPjjWebhookEvent(left("missing-sid", base + 10, ""), harness.transaction);
  assert.equal(harness.state().participant.liveKitParticipantSid, "PA_NEW");
  assert.equal(harness.state().attendanceWrites, 0);
});

test("leave/rejoin records two intervals once and excludes the disconnected gap", async () => {
  const harness = createHarness();
  const base = 1_786_492_800;
  await processPjjWebhookEvent(joined("join-a", base, "PA_A"), harness.transaction);
  await processPjjWebhookEvent(left("leave-a", base + 60, "PA_A"), harness.transaction);
  await processPjjWebhookEvent(joined("join-b", base + 120, "PA_B"), harness.transaction);
  await processPjjWebhookEvent(left("leave-b", base + 180, "PA_B"), harness.transaction);
  await processPjjWebhookEvent(left("leave-b-replay", base + 181, "PA_B"), harness.transaction);
  assert.equal(harness.state().participant.totalSeconds, 120);
  assert.equal(harness.state().participant.joinCount, 2);
  assert.equal(harness.state().attendanceWrites, 2);
});
