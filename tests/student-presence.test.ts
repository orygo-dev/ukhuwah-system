import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import * as nextServer from "next/server";
import * as zod from "zod";
import * as policy from "../src/lib/student-presence-policy";
import { createPresencePoller } from "../src/lib/presence-polling";

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
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("presence expires at 2 minutes; no signal is not falsely labelled offline", () => {
  const now = new Date("2026-08-28T10:00:00Z");
  assert.equal(policy.presenceStatus(null, now), "untracked");
  assert.equal(policy.presenceStatus(new Date(now.getTime() - 119_000), now), "online");
  assert.equal(policy.presenceStatus(new Date(now.getTime() - 120_001), now), "offline");
  assert.equal(policy.presenceStatus(new Date(now.getTime() + 1), now), "offline");
});

test("heartbeat supports HTTPS behind Apache without accepting foreign origins", () => {
  const request = (origin: string) => new Request("http://localhost:3000/api/student-presence/heartbeat", {
    headers: { origin, "x-forwarded-host": "school.example.test", "sec-fetch-site": "same-origin" },
  });
  assert.equal(policy.allowsPresenceOrigin(request("https://school.example.test")), true);
  assert.equal(policy.allowsPresenceOrigin(request("https://other.example.test")), false);
  assert.equal(policy.allowsPresenceOrigin(request("null")), false);
});

// Small evaluator for the Prisma predicates emitted by the real route. Fails
// for unsupported operators so a broadened query cannot silently pass tests.
function matches(row: unknown, where: unknown): boolean {
  if (where === null || typeof where !== "object") return row === where;
  return Object.entries(where).every(([key, expected]) => {
    if (key === "AND") return (expected as unknown[]).every((part) => matches(row, part));
    if (key === "OR") return (expected as unknown[]).some((part) => matches(row, part));
    if (key === "is") return row != null && matches(row, expected);
    if (key === "some") return Array.isArray(row) && row.some((item) => matches(item, expected));
    if (key === "contains") return typeof row === "string" && row.includes(String(expected));
    if (key === "gte") return row instanceof Date && row >= (expected as Date);
    if (key === "lte") return row instanceof Date && row <= (expected as Date);
    assert.ok(row !== null && typeof row === "object" && key in row, `Unsupported field ${key}`);
    return matches((row as Record<string, unknown>)[key], expected);
  });
}
function apiFixture(viewer: policy.PresenceViewer | null) {
  const sample = (id: string, teacherId: string, schoolId: string, active = true) => ({
    id, name: id, isActive: active, user: { role: "STUDENT" },
    classRoom: { name: `Kelas ${id}`, isActive: true, teacherId, schoolId, school: { name: schoolId }, teacherAssignments: [] },
    presence: { lastSeenAt: new Date() },
  });
  const rows = [sample("A", "teacher-a", "school-a"), sample("B", "teacher-b", "school-b"), sample("C", "teacher-c", "school-a"), sample("Inactive", "teacher-a", "school-a", false)];
  const touched: string[] = [];
  let queries = 0;
  let unavailable = false;
  const dependencies = {
    "next/server": nextServer, zod,
    "@/lib/auth": { auth: async () => viewer ? { user: viewer } : null },
    "@/lib/student-presence-policy": policy,
    "@/lib/student-presence": { touchStudentPresence: async (id: string) => { if (unavailable) throw new Error("presence unavailable"); touched.push(id); } },
    "@/lib/prisma": { prisma: { student: {
      count: async ({ where }: { where: unknown }) => { queries++; if (unavailable) throw new Error("presence unavailable"); return rows.filter((row) => matches(row, where)).length; },
      findMany: async ({ where, take, skip, select }: { where: unknown; take: number; skip: number; select: object }) => {
        queries++;
        assert.equal(take, 50);
        assert.ok(skip >= 0);
        assert.deepEqual(Object.keys(select).sort(), ["classRoom", "id", "name", "presence"]);
        return rows.filter((row) => matches(row, where)).slice(skip, skip + take);
      },
    } } },
  };
  const { GET } = load<{ GET: (req: nextServer.NextRequest) => Promise<Response> }>("src/app/api/student-presence/route.ts", dependencies);
  const { POST } = load<{ POST: (req: nextServer.NextRequest) => Promise<Response> }>("src/app/api/student-presence/heartbeat/route.ts", dependencies);
  return {
    get: (query = "") => GET(new nextServer.NextRequest(`https://example.test/api/student-presence${query}`)),
    post: (headers = {}, body = "") => POST(new nextServer.NextRequest("https://example.test/api/student-presence/heartbeat?studentId=victim", { method: "POST", headers, body })),
    touched, rows, queries: () => queries,
    setUnavailable: (value: boolean) => { unavailable = value; },
  };
}

test("teacher sees owned classes only; active assigned classes are included", async () => {
  const f = apiFixture({ id: "teacher-a", role: "TEACHER" });
  let body = await (await f.get()).json();
  assert.deepEqual(body.students.map((s: { id: string }) => s.id), ["A"]);
  (f.rows[1].classRoom.teacherAssignments as object[]).push({ teacherId: "teacher-a", isActive: true });
  body = await (await f.get()).json();
  assert.deepEqual(body.students.map((s: { id: string }) => s.id), ["A", "B"]);
});

test("school admin counts, search and list cannot leak another school", async () => {
  const f = apiFixture({ id: "admin-a", role: "SCHOOL_ADMIN", schoolId: "school-a" });
  const response = await f.get();
  const body = await response.json();
  assert.equal(body.total, 2);
  assert.equal(body.online, 2);
  assert.deepEqual(body.students.map((s: { id: string }) => s.id), ["A", "C"]);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal((await (await f.get("?q=school-b")).json()).total, 0);
  assert.equal((await f.get("?schoolId=school-b")).status, 400);
});

test("super admin sees all active students, not inactive roster entries", async () => {
  const body = await (await apiFixture({ id: "root", role: "SUPER_ADMIN" }).get()).json();
  assert.equal(body.total, 3);
  assert.equal(body.students.length, 3);
  assert.ok(!JSON.stringify(body).includes("teacherId"));
  assert.ok(!JSON.stringify(body).includes("userId"));
});

test("anonymous, students, province admin and unlinked school admin fail closed before DB queries", async () => {
  for (const viewer of [null, { id: "s", role: "STUDENT" }, { id: "p", role: "PROVINCE_ADMIN" }, { id: "a", role: "SCHOOL_ADMIN", schoolId: null }]) {
    const f = apiFixture(viewer);
    assert.equal((await f.get()).status, viewer ? 403 : 401);
    assert.equal(f.queries(), 0);
  }
});

test("pagination is bounded and invalid filters cannot execute queries", async () => {
  const f = apiFixture({ id: "root", role: "SUPER_ADMIN" });
  for (const query of ["?page=0", "?page=-1", "?page=10001", "?page=1.2", "?status=secret", `?q=${"x".repeat(81)}`]) {
    assert.equal((await f.get(query)).status, 400);
  }
  assert.equal(f.queries(), 0);
  assert.equal((await (await f.get("?page=2&status=all")).json()).students.length, 0);
});

test("heartbeat cannot impersonate another student using body/query and blocks foreign origins", async () => {
  const viewer = { id: "user-a", role: "STUDENT", studentId: "student-a" };
  const f = apiFixture(viewer);
  assert.equal((await f.post({}, '{"studentId":"victim","lastSeenAt":"2099-01-01"}')).status, 204);
  assert.deepEqual(f.touched, ["student-a"]);
  assert.equal((await f.post({ origin: "https://attacker.test" })).status, 403);
  assert.equal((await f.post({ "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal(f.touched.length, 1);
  assert.equal((await apiFixture({ id: "t", role: "TEACHER" }).post()).status, 403);
  assert.equal((await apiFixture(null).post()).status, 401);
});

test("presence writes are throttled, monotonic and concurrent first heartbeat is safe", async () => {
  let stored: Date | null = null;
  let writes = 0;
  const dependencies = {
    "server-only": {}, "@prisma/client": { Prisma },
    "@/lib/prisma": { prisma: { studentPresence: {
      updateMany: async ({ where, data }: { where: { lastSeenAt: { lt: Date } }; data: { lastSeenAt: Date } }) => {
        if (stored && stored < where.lastSeenAt.lt) { stored = data.lastSeenAt; writes++; return { count: 1 }; }
        return { count: 0 };
      },
      findUnique: async () => stored ? { studentId: "a" } : null,
      create: async ({ data }: { data: { lastSeenAt: Date } }) => {
        if (stored) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
        stored = data.lastSeenAt; writes++;
      },
    } } },
  };
  const { touchStudentPresence: touch } = load<{ touchStudentPresence: (id: string, now: Date) => Promise<void> }>("src/lib/student-presence.ts", dependencies);
  const start = new Date("2026-08-28T10:00:00Z");
  await Promise.all(Array.from({ length: 8 }, () => touch("a", start)));
  assert.equal(writes, 1);
  await touch("a", new Date(start.getTime() + 20_000));
  assert.equal(writes, 1);
  await touch("a", new Date(start.getTime() + 45_000));
  assert.equal(writes, 2);
  await touch("a", start);
  assert.equal(writes, 2);
  assert.equal(stored!.getTime(), start.getTime() + 45_000);
});

test("poller is single-flight, cancels on hide/dispose and does not start after disposal", async () => {
  let visible = true;
  let calls = 0;
  let signal: AbortSignal | undefined;
  let release: () => void = () => {};
  const poller = createPresencePoller(async (current) => {
    calls++; signal = current;
    await new Promise<void>((resolve) => { release = resolve; });
  }, () => visible);
  poller.refresh(); poller.refresh();
  await tick();
  assert.equal(calls, 1);
  visible = false;
  poller.refresh();
  assert.equal(signal!.aborted, true);
  release(); await tick();
  visible = true;
  poller.refresh();
  await tick();
  assert.equal(calls, 2);
  poller.stop(); release(); await tick();
  poller.refresh(); await tick();
  assert.equal(calls, 2);
  const immediate = createPresencePoller(async () => { calls++; }, () => true);
  immediate.refresh(); immediate.stop(); await tick();
  assert.equal(calls, 2);
});

test("poller stops after authorization failure and ignores optional failures", async () => {
  let calls = 0;
  const stopped = createPresencePoller(async () => { calls++; return false; }, () => true);
  stopped.refresh(); await tick(); stopped.refresh(); await tick();
  assert.equal(calls, 1);
  const retry = createPresencePoller(async () => { throw new Error("optional backend unavailable"); }, () => true);
  retry.refresh(); await tick(); retry.stop();
});

test("migration is additive and presence cleanup cascades without changing login", () => {
  const sql = fs.readFileSync("prisma/migrations/202608280001_student_presence/migration.sql", "utf8");
  assert.doesNotMatch(sql, /ALTER|DROP|TRUNCATE|DELETE FROM/);
  assert.match(sql, /PRIMARY KEY \(`student_id`\)/);
  assert.match(sql, /ON DELETE CASCADE/);
  assert.match(sql, /INDEX .*last_seen_at/);
});

test("presence outage returns 503 without fake offline data, then recovers", async () => {
  const monitor = apiFixture({ id: "admin", role: "SUPER_ADMIN" });
  monitor.setUnavailable(true);
  const response = await monitor.get();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).students, undefined);
  monitor.setUnavailable(false);
  assert.equal((await monitor.get()).status, 200);
  const sender = apiFixture({ id: "user-a", role: "STUDENT", studentId: "student-a" } as policy.PresenceViewer);
  sender.setUnavailable(true);
  assert.equal((await sender.post()).status, 503);
  assert.equal(sender.touched.length, 0);
  sender.setUnavailable(false);
  assert.equal((await sender.post()).status, 204);
});

test("online filter excludes expired signals; all view preserves untracked distinction", async () => {
  const f = apiFixture({ id: "admin", role: "SUPER_ADMIN" });
  f.rows[0].presence.lastSeenAt = new Date(Date.now() - 130_000);
  const online = await (await f.get()).json();
  assert.equal(online.online, 2);
  assert.ok(!online.students.some((row: { id: string }) => row.id === "A"));
  const all = await (await f.get("?status=all")).json();
  assert.equal(all.students.find((row: { id: string }) => row.id === "A").status, "offline");
});

test("poller aborts timed-out requests and cancels scheduled retries", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let captured: AbortSignal | undefined;
  const poller = createPresencePoller(async (signal) => {
    calls++; captured = signal;
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
  }, () => true);
  poller.refresh(); await tick();
  context.mock.timers.tick(15_000); await tick();
  assert.equal(captured!.aborted, true);
  poller.stop();
  context.mock.timers.tick(90_000); await tick();
  assert.equal(calls, 1);
});
