import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as nextServer from "next/server";
import { z } from "zod";

function load<T>(file: string, dependencies: Record<string, unknown>): T {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", code)((name: string) => {
    assert.ok(name in dependencies, `Unexpected import ${name}`);
    return dependencies[name];
  }, exports);
  return exports as T;
}

test("student social text blocks external contact data and bounds content", () => {
  const module = load<{ normalizeSocialText: (value: unknown, max?: number) => string }>(
    "src/lib/student-social.ts",
    {
      "server-only": {},
      "@/lib/prisma": { prisma: {} },
      "@/lib/chat": { directConversationKey: () => "a:b" },
    },
  );
  assert.equal(module.normalizeSocialText("  Halo   teman  "), "Halo teman");
  assert.throws(() => module.normalizeSocialText("https://example.test"), /EXTERNAL_LINK/);
  assert.throws(() => module.normalizeSocialText("hubungi 0812 3456 7890"), /PRIVATE_CONTACT/);
  assert.throws(() => module.normalizeSocialText("siswa@example.test"), /PRIVATE_CONTACT/);
  assert.throws(() => module.normalizeSocialText("x".repeat(501), 500), /INVALID_MESSAGE/);
});

test("follow route is student-only, idempotent, block-aware and queues push once", async () => {
  let viewer: { id: string; role: string } | null = { id: "student-a", role: "STUDENT" };
  let following = false;
  let blocked = false;
  let creates = 0;
  let pushes = 0;
  let rateLimitOk = true;
  const dependencies = {
    "next/server": { NextResponse: nextServer.NextResponse, after: (fn: () => unknown) => fn() },
    "@/lib/auth": { auth: async () => viewer ? { user: viewer } : null },
    "@/lib/mobile-api": {
      mobileUnauthorized: () => nextServer.NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      mobileForbidden: () => nextServer.NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    },
    "@/lib/prisma": {
      prisma: {
        $transaction: async (fn: (tx: unknown) => unknown) => fn({
          studentBlock: { findFirst: async () => blocked ? { id: "block" } : null },
          studentFollow: {
            createMany: async () => {
              if (following) return { count: 0 };
              creates++;
              following = true;
              return { count: 1 };
            },
            findUnique: async () => following ? { id: "reverse" } : null,
          },
        }),
        studentFollow: {
          deleteMany: async () => { following = false; },
        },
      },
    },
    "@/lib/student-social-notifications": {
      notifyStudentFollow: async () => { pushes++; },
    },
    "@/lib/security-rate-limit": {
      consumeSecurityRateLimit: async () => ({
        ok: rateLimitOk,
        remaining: rateLimitOk ? 39 : 0,
        retryAfterSec: rateLimitOk ? 0 : 30,
      }),
      rateLimitHeaders: (result: { retryAfterSec: number }) => ({
        "Retry-After": String(result.retryAfterSec),
      }),
    },
    "@/lib/student-social": {
      socialPair: async () => ({ viewer: { id: "student-a", name: "A" }, targetUserId: "student-b" }),
      socialError: (error: Error) => ({ code: error.message, message: error.message }),
    },
  };
  const route = load<{
    POST: (req: Request, params: unknown) => Promise<Response>;
    DELETE: (req: Request, params: unknown) => Promise<Response>;
  }>("src/app/api/mobile/v1/student/social/follows/[studentId]/route.ts", dependencies);
  const params = { params: Promise.resolve({ studentId: "profile-b" }) };
  assert.equal((await route.POST(new Request("https://test"), params)).status, 200);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(creates, 1);
  assert.equal(pushes, 1);
  assert.equal((await route.POST(new Request("https://test"), params)).status, 200);
  assert.equal(creates, 1);
  blocked = true;
  following = false;
  assert.equal((await route.POST(new Request("https://test"), params)).status, 400);
  viewer = { id: "teacher", role: "TEACHER" };
  assert.equal((await route.POST(new Request("https://test"), params)).status, 403);
  viewer = null;
  assert.equal((await route.POST(new Request("https://test"), params)).status, 401);
  viewer = { id: "student-a", role: "STUDENT" };
  rateLimitOk = false;
  assert.equal((await route.POST(new Request("https://test"), params)).status, 429);
});

test("migration is additive, MariaDB-safe, constrained and indexed", () => {
  const sql = fs.readFileSync("prisma/migrations/202608310001_student_social/migration.sql", "utf8");
  assert.doesNotMatch(sql, /DROP|TRUNCATE|DELETE FROM|"student_/i);
  assert.match(sql, /UNIQUE INDEX `student_follows_follower_id_following_id_key`/);
  assert.match(sql, /FOREIGN KEY .* ON DELETE CASCADE/);
  assert.match(sql, /student_message_requests_recipient_id_status_created_at_idx/);
  assert.match(sql, /messages_client_message_id_key/);
});

test("message route enforces access, rate limit, idempotency and targeted push", () => {
  const source = fs.readFileSync(
    "src/app/api/mobile/v1/student/social/conversations/[id]/route.ts",
    "utf8",
  );
  assert.match(source, /session\.user\.role !== "STUDENT"/);
  assert.match(source, /assertStudentConversationAccess/);
  assert.match(source, /recent >= 20/);
  assert.match(source, /clientMessageId/);
  assert.match(source, /message\.createMany/);
  assert.match(source, /skipDuplicates: true/);
  assert.match(source, /if \(result\.inserted\)/);
  assert.match(source, /notifyStudentMessage\(otherId/);
});

test("message retry returns the original row without a duplicate push", async () => {
  let stored: Record<string, unknown> | null = null;
  let pushes = 0;
  let conversationUpdates = 0;
  const prisma = {
    message: { count: async () => 0 },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({
      message: {
        createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
          if (stored) return { count: 0 };
          stored = {
            id: "message-1",
            ...data[0],
            createdAt: new Date("2026-08-31T00:00:00.000Z"),
          };
          return { count: 1 };
        },
        findUnique: async () => stored,
      },
      conversation: { update: async () => { conversationUpdates++; } },
    }),
  };
  const route = load<{ POST: (request: Request, params: unknown) => Promise<Response> }>(
    "src/app/api/mobile/v1/student/social/conversations/[id]/route.ts",
    {
      "next/server": { NextResponse: nextServer.NextResponse, after: (fn: () => unknown) => fn() },
      zod: { z },
      "@/lib/auth": { auth: async () => ({ user: { id: "student-a", role: "STUDENT", name: "A" } }) },
      "@/lib/mobile-api": {
        mobileUnauthorized: () => nextServer.NextResponse.json({}, { status: 401 }),
        mobileForbidden: () => nextServer.NextResponse.json({}, { status: 403 }),
      },
      "@/lib/prisma": { prisma },
      "@/lib/student-social-notifications": {
        notifyStudentMessage: async () => { pushes++; },
      },
      "@/lib/student-social": {
        assertStudentConversationAccess: async () => ({ otherId: "student-b" }),
        normalizeSocialText: (value: unknown) => String(value),
        socialError: (error: Error) => ({ code: error.message, message: error.message }),
      },
    },
  );
  const params = { params: Promise.resolve({ id: "conversation-1" }) };
  const makeRequest = () => new Request("https://test", {
    method: "POST",
    body: JSON.stringify({ content: "Halo", clientMessageId: "client-message-1" }),
  });
  assert.equal((await route.POST(makeRequest(), params)).status, 201);
  assert.equal((await route.POST(makeRequest(), params)).status, 200);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(pushes, 1);
  assert.equal(conversationUpdates, 1);
});

test("push payloads route messages to inbox without changing teacher chat", () => {
  const push = fs.readFileSync("src/lib/student-social-notifications.ts", "utf8");
  const teacherRoute = fs.readFileSync("src/app/api/chat/conversations/route.ts", "utf8");
  assert.match(push, /type: "student_message"/);
  assert.match(push, /conversationId/);
  assert.match(push, /appId: STUDENT_APP_ID/);
  assert.match(teacherRoute, /role !== "TEACHER"/);
});
