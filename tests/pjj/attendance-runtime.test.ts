import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as nextServer from "next/server";
import { createSingleFlightRunner } from "../../src/lib/pjj-single-flight";

function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const exports = {};
  const require = createRequire(path.resolve(file));
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", code)((name: string): unknown => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) {
      const local = `src/${name.slice(2)}`;
      return load(existsSync(`${local}.ts`) ? `${local}.ts` : `${local}.tsx`, dependencies);
    }
    return require(name);
  }, exports);
  return exports as T;
}

type Peer = { identity: string; sid: string; isActive: boolean; connectionQuality?: string };
function panel({ peers = [], state = "connected", persistedOnline = false, sid = null, moderator = true }: {
  peers?: Peer[]; state?: string; persistedOnline?: boolean; sid?: string | null; moderator?: boolean;
} = {}) {
  let stateIndex = 0;
  const roster = {
    students: [{ studentId: "student-1", userId: "student-user", name: "Siswa Uji", attendanceStatus: "NEEDS_REVIEW", totalSeconds: 0, online: persistedOnline, liveKitParticipantSid: sid, joinCount: 0 }],
    summary: { totalStudents: 1, present: 0, online: Number(persistedOnline) },
    viewer: { isModerator: moderator, studentId: moderator ? null : "student-1" },
  };
  const { LiveAttendancePanel } = load<{ LiveAttendancePanel: React.ComponentType<{ liveSessionId: string }> }>(
    "src/components/pjj/room/live-attendance-panel.tsx", {
      react: { ...React, useState: (initial: unknown) => React.useState(stateIndex++ === 0 ? roster : initial) },
      "@livekit/components-react": { useRoomContext: () => ({}), useParticipants: () => peers, useConnectionState: () => state },
    },
  );
  return renderToStaticMarkup(React.createElement(LiveAttendancePanel, { liveSessionId: "session-1" }));
}
const active: Peer = { identity: "user:student-user", sid: "PA_NEW", isActive: true };

test("regression: active peer is Online even before webhook records join", () => {
  const html = panel({ peers: [active] });
  assert.match(html, />Online</);
  assert.match(html, /1 online/);
  assert.match(html, /belum tersinkron/i);
});
test("regression: departed peer is Offline even before delayed leave webhook", () => {
  const html = panel({ persistedOnline: true, sid: "PA_OLD" });
  assert.match(html, />Offline</);
  assert.match(html, /0 online/);
});
test("teacher reconnect never falsely labels the entire roster Offline", () => {
  const html = panel({ state: "reconnecting" });
  assert.doesNotMatch(html, />Offline</);
  assert.match(html, /Memulihkan koneksi/);
});
test("signal-only join does not count as media-active presence", () => {
  const html = panel({ peers: [{ ...active, isActive: false }] });
  assert.doesNotMatch(html, />Online</);
  assert.match(html, /Menghubungkan/);
});
test("lost peer connection is not shown as healthy online", () => {
  assert.match(panel({ peers: [{ ...active, connectionQuality: "lost" }] }), /Memulihkan koneksi/);
});
test("matching is by server user identity, not display name, metadata, or other-room state", () => {
  const html = panel({ peers: [{ ...active, identity: "user:other-user" }] });
  assert.match(html, />Offline</);
});
test("replacement SID warns about stale attendance association", () => {
  assert.match(panel({ peers: [active], persistedOnline: true, sid: "PA_OLD" }), /belum tersinkron/i);
  assert.doesNotMatch(panel({ peers: [active], persistedOnline: true, sid: active.sid }), /belum tersinkron/i);
});
test("manual correction remains available only to moderator", () => {
  assert.match(panel(), /Koreksi kehadiran/);
  assert.doesNotMatch(panel({ moderator: false }), /<select/);
});

function webhook({ writeError, verifyError, configError, duplicateReceipt = false }: {
  writeError?: Error; verifyError?: Error; configError?: Error; duplicateReceipt?: boolean;
}) {
  const event = { id: "event-safe-id", event: "participant_joined", createdAt: 1_786_492_800, room: { name: "test-room" } };
  const receiver = { receive: async () => { if (verifyError) throw verifyError; return event; } };
  return load<{ POST: (request: Request) => Promise<Response> }>("src/app/api/livekit/webhook/route.ts", {
    "next/server": nextServer,
    "@/lib/livekit": {
      receiveLiveKitWebhook: async () => receiver.receive(),
      getLiveKitWebhookReceiver: async () => { if (configError) throw configError; return receiver; },
    },
    "@/lib/prisma": { prisma: {
      $transaction: async () => { if (writeError) throw writeError; },
      liveKitWebhookEvent: { findUnique: async () => duplicateReceipt ? { id: event.id } : null },
    } },
    "@/lib/pjj-livekit-webhook": { processPjjWebhookEvent: async (_event: unknown, transaction: (fn: () => Promise<void>) => Promise<void>) => transaction(async () => {}) },
  });
}
const request = () => new Request("https://example.test/api/livekit/webhook", { method: "POST", body: "{}" });

test("verified webhook DB failure is retryable 503, not invalid-signature 401", async () => {
  const response = await webhook({ writeError: new Error("database unavailable") }).POST(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Retry-After"), "1");
  assert.doesNotMatch(await response.text(), /database unavailable/);
});
test("unrelated unique constraint failure is not acknowledged as duplicate receipt", async () => {
  const response = await webhook({ writeError: Object.assign(new Error("unique failure"), { code: "P2002" }) }).POST(request());
  assert.equal(response.status, 503);
});
test("committed duplicate receipt can be acknowledged safely", async () => {
  const response = await webhook({ writeError: Object.assign(new Error("duplicate receipt"), { code: "P2002" }), duplicateReceipt: true }).POST(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
});
test("invalid signature never processes an event", async () => {
  assert.equal((await webhook({ verifyError: new Error("invalid signature") }).POST(request())).status, 401);
});
test("server configuration failure remains retryable, not a rejected signature", async () => {
  assert.equal((await webhook({ configError: new Error("config unavailable") }).POST(request())).status, 503);
});

test("request timeout cancels fetch, reports an error, and allows next refresh", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const runner = createSingleFlightRunner({ timeoutMs: 15000 });
  let aborted = false;
  const result = runner.run((signal) => new Promise<void>((_resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); }, { once: true });
  }));
  assert.equal((await runner.run(async () => {})).status, "skipped");
  context.mock.timers.tick(15000);
  assert.equal((await result).status, "error");
  assert.equal(aborted, true);
  assert.equal((await runner.run(async () => "fresh")).status, "success");
});

test("cleanup aborts request and cannot emit timeout error after unmount", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const runner = createSingleFlightRunner({ timeoutMs: 15000 });
  const result = runner.run((signal) => new Promise<void>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  runner.stop();
  context.mock.timers.tick(15000);
  assert.equal((await result).status, "aborted");
  assert.equal((await runner.run(async () => "stale")).status, "skipped");
});
