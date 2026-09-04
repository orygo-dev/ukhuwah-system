import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { isSpotlightSharePath, spotlightPath } from "../src/lib/spotlight-links";

// Execute application handlers, substituting only auth/database/framework boundaries.
function load(file: string, mocks: Record<string, unknown>, extra = "") {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8") + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports: Record<string, (...args: unknown[]) => unknown> = {};
  new Function("require", "exports", code)((name: string) => mocks[name] ?? {}, exports);
  return exports;
}

const guard = { isTeacherWorkspaceRole: (role: string) => role === "TEACHER" || role === "SUPER_ADMIN" };
const portal = load("src/lib/student-portal.ts", {});

test("kind-specific canonical links and narrow login allowlist reject redirect tricks", () => {
  assert.equal(spotlightPath("student", "post1"), "/spotlight/student/post1");
  assert.equal(spotlightPath("teacher", "post1"), "/spotlight/teacher/post1");
  assert.equal(isSpotlightSharePath("/spotlight/student/post1"), true);
  for (const path of ["//evil.test", "/spotlight/student/../admin", "/spotlight/student/%2f%2fevil", "/spotlight/student/p?next=https://evil.test", "/spotlight/student/p\\evil", "/spotlight/student/p/extra"]) {
    assert.equal(isSpotlightSharePath(path), false, path);
  }
});

test("login retains shared target for all roles; normal role routing is unchanged", () => {
  const form = load("src/components/auth/login-form.tsx", { "@/lib/spotlight-links": { isSpotlightSharePath } }, "\nexport { resolveDestination };");
  for (const [role, home] of [["TEACHER", "/dashboard"], ["STUDENT", "/student"], ["SUPER_ADMIN", "/admin"], ["SCHOOL_ADMIN", "/school"], ["PROVINCE_ADMIN", "/province"]]) {
    assert.equal(form.resolveDestination(role, "/spotlight/student/post1"), "/spotlight/student/post1");
    assert.equal(form.resolveDestination(role, "/dashboard"), home);
  }
});

test("unauthenticated legacy link keeps post query in login callback", async () => {
  const proxy = load("src/proxy.ts", {
    "next/server": { NextResponse },
    "@/lib/auth-session-cookie": { findAuthSessionCookieName: () => undefined },
  });
  const response = await proxy.default(new NextRequest("https://example.test/dashboard/spotlight?post=old-post")) as Response;
  const url = new URL(response.headers.get("location")!);
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("callbackUrl"), "/dashboard/spotlight?post=old-post");
});

function sharedFixture() {
  let mediaReads = 0;
  let activeStudent = true;
  let schoolId: string | null = "school1";
  let record: { id: string; status: string; visibility: string; classRoomId: string; schoolId: string } | null = {
    id: "post1", status: "PUBLISHED", visibility: "CLASS", classRoomId: "class1", schoolId: "school1",
  };
  const media = { caption: "Restricted caption", videoUrl: "/private.mp4", thumbnailUrl: null };
  const prisma = {
    student: { findFirst: async ({ where }: { where: unknown }) => {
      assert.deepEqual(where, { userId: "student-user", isActive: true, classRoom: { isActive: true } });
      return activeStudent ? { classRoomId: "class1", classRoom: { schoolId } } : null;
    } },
    spotlightPost: { findFirst: async ({ where }: { where: unknown }) => {
      mediaReads++;
      assert.deepEqual(where, { id: "post1", isPublished: true });
      return record ? { ...media, author: { name: "Teacher" } } : null;
    } },
    studentSpotlightSubmission: { findFirst: async ({ where }: { where: { id: string; status: string; OR: { visibility: string; classRoomId?: string; classRoom?: { schoolId: string } }[] } }) => {
      mediaReads++;
      const r = record;
      return r && r.id === where.id && r.status === where.status && where.OR.some((scope) =>
        r.visibility === scope.visibility && (!scope.classRoomId || scope.classRoomId === r.classRoomId) && (!scope.classRoom || scope.classRoom.schoolId === r.schoolId)
      ) ? { ...media, student: { name: "Student" } } : null;
    } },
  };
  const service = load("src/lib/spotlight-shared-content.ts", {
    "@/lib/prisma": { prisma }, "@/lib/api-role-guard": guard, "@/lib/student-portal": portal,
  });
  return {
    get: (kind: string, viewer?: { id: string; role: string }) => service.getSharedSpotlight(kind, "post1", viewer) as Promise<{ status: string; post?: unknown }>,
    reads: () => mediaReads,
    inactive: () => { activeStudent = false; },
    noSchool: () => { schoolId = null; },
    change: (fields: Partial<NonNullable<typeof record>>) => { record = { ...record!, ...fields }; },
    remove: () => { record = null; },
  };
}
const student = { id: "student-user", role: "STUDENT" };

test("anonymous and wrong-role requests do not read or leak media", async () => {
  const f = sharedFixture();
  assert.deepEqual(await f.get("student"), { status: "signin" });
  assert.deepEqual(await f.get("teacher"), { status: "signin" });
  assert.deepEqual(await f.get("teacher", student), { status: "forbidden" });
  assert.deepEqual(await f.get("student", { id: "teacher", role: "TEACHER" }), { status: "forbidden" });
  assert.equal(f.reads(), 0);
});

test("student sharing enforces CLASS, SCHOOL, GLOBAL and publication visibility", async () => {
  const f = sharedFixture();
  assert.equal((await f.get("student", student)).status, "ready");
  f.change({ classRoomId: "class2" });
  assert.equal((await f.get("student", student)).status, "missing");
  f.change({ visibility: "SCHOOL" });
  assert.equal((await f.get("student", student)).status, "ready");
  f.change({ schoolId: "other-school" });
  assert.equal((await f.get("student", student)).status, "missing");
  f.change({ visibility: "GLOBAL" });
  assert.equal((await f.get("student", student)).status, "ready");
  for (const status of ["ARCHIVED", "REJECTED", "PENDING_REVIEW", "REVISION_REQUESTED"]) {
    f.change({ status });
    assert.deepEqual(await f.get("student", student), { status: "missing" });
  }
  f.remove();
  assert.deepEqual(await f.get("student", student), { status: "missing" });
});

test("school-less students use same-class fallback; inactive students cannot read", async () => {
  const f = sharedFixture();
  f.noSchool();
  f.change({ visibility: "SCHOOL" });
  assert.equal((await f.get("student", student)).status, "ready");
  f.change({ classRoomId: "other" });
  assert.equal((await f.get("student", student)).status, "missing");
  f.inactive();
  assert.equal((await f.get("student", student)).status, "forbidden");
});

test("teacher shared link resolves exact ID without relying on feed pagination", async () => {
  const f = sharedFixture();
  assert.equal((await f.get("teacher", { id: "t1", role: "TEACHER" })).status, "ready");
  assert.equal((await f.get("teacher", { id: "a1", role: "SUPER_ADMIN" })).status, "ready");
  f.remove();
  assert.equal((await f.get("teacher", { id: "t1", role: "TEACHER" })).status, "missing");
});

function deleteFixture() {
  let viewer: { id: string; role: string } | null = student;
  let exists = true;
  let writes = 0;
  const route = load("src/app/api/student/spotlight-submissions/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/auth": { auth: async () => viewer ? { user: viewer } : null },
    "@/lib/prisma": { prisma: { studentSpotlightSubmission: { deleteMany: async ({ where }: { where: { id: string; student: { userId: string; isActive: boolean } } }) => {
      writes++;
      assert.equal(where.student.isActive, true);
      const count = Number(exists && where.id === "post1" && where.student.userId === student.id);
      if (count) exists = false;
      return { count };
    } } } },
  });
  return {
    viewer: (value: typeof viewer) => { viewer = value; }, writes: () => writes,
    delete: () => route.DELETE(new Request("https://example.test/api/student/spotlight-submissions/post1", { method: "DELETE" }), { params: Promise.resolve({ id: "post1" }) }) as Promise<Response>,
  };
}

test("deletion denies anonymous, wrong role and another student; owner succeeds", async () => {
  const f = deleteFixture();
  f.viewer(null); assert.equal((await f.delete()).status, 401);
  f.viewer({ id: "t1", role: "TEACHER" }); assert.equal((await f.delete()).status, 403);
  assert.equal(f.writes(), 0);
  f.viewer({ id: "other-student", role: "STUDENT" }); assert.equal((await f.delete()).status, 404);
  f.viewer(student); assert.equal((await f.delete()).status, 200);
  assert.equal((await f.delete()).status, 404);
});

test("concurrent owner deletion cannot delete twice or turn into server error", async () => {
  const f = deleteFixture();
  const results = await Promise.all([f.delete(), f.delete()]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 404]);
});

function boardDeleteFixture() {
  let viewer: { id: string; role: string } | null = student;
  let exists = true;
  let writes = 0;
  const route = load("src/app/api/student/board-posts/[id]/route.ts", {
    "next/server": { NextResponse },
    "@/lib/auth": { auth: async () => viewer ? { user: viewer } : null },
    "@/lib/prisma": { prisma: { studentBoardPost: { deleteMany: async ({ where }: { where: { id: string; authorId: string; student: { userId: string; isActive: boolean } } }) => {
      writes++;
      assert.equal(where.student.isActive, true);
      assert.equal(where.authorId, where.student.userId);
      const count = Number(exists && where.id === "board1" && where.authorId === student.id);
      if (count) exists = false;
      return { count };
    } } } },
  });
  return {
    viewer: (value: typeof viewer) => { viewer = value; },
    writes: () => writes,
    delete: () => route.DELETE(
      new Request("https://example.test/api/student/board-posts/board1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "board1" }) },
    ) as Promise<Response>,
  };
}

test("mading deletion is owner-only and remains atomic under concurrent requests", async () => {
  const denied = boardDeleteFixture();
  denied.viewer(null); assert.equal((await denied.delete()).status, 401);
  denied.viewer({ id: "teacher1", role: "TEACHER" });
  assert.equal((await denied.delete()).status, 403);
  assert.equal(denied.writes(), 0);
  denied.viewer({ id: "other-student", role: "STUDENT" });
  assert.equal((await denied.delete()).status, 404);

  const owner = boardDeleteFixture();
  const results = await Promise.all([owner.delete(), owner.delete()]);
  assert.deepEqual(results.map((response) => response.status).sort(), [200, 404]);
});

test("student dashboard resolves the author school for current and legacy classes", () => {
  const school = load("src/lib/student-content-school.ts", {});
  const room = (
    school: string | null,
    teacherSchool: string | null,
    profileSchool: string | null,
  ) => ({
    school: school ? { name: school } : null,
    teacher: {
      school: teacherSchool ? { name: teacherSchool } : null,
      teachingProfiles: profileSchool ? [{ schoolName: profileSchool }] : [],
    },
  });

  assert.equal(school.studentContentSchoolName(room("Sekolah Kelas", "Sekolah Guru", "Profil Guru")), "Sekolah Kelas");
  assert.equal(school.studentContentSchoolName(room(null, "Sekolah Guru", "Profil Guru")), "Sekolah Guru");
  assert.equal(school.studentContentSchoolName(room(null, null, "Profil Guru")), "Profil Guru");
  assert.equal(school.studentContentSchoolName(room(null, null, null)), null);
});
