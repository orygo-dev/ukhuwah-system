import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getMapelOptions, normalizeJenjang } from "@/lib/curriculum";

const read = (path: string) => fs.readFileSync(path, "utf8");

test("legacy class levels still expose curriculum subjects", () => {
  assert.equal(normalizeJenjang("Kelas X"), "sma");
  assert.ok(getMapelOptions("Kelas X").length > 0);
  assert.equal(normalizeJenjang("SMP / MTs"), "smp");
});

test("class creation contracts require canonical jenjang", () => {
  const source = read("src/app/api/attendance/classes/route.ts");
  assert.match(source, /refine\(isCanonicalJenjang/);
});

test("school directory supports cascading exact school, province, and regency queries", () => {
  const source = read("src/app/api/school-directory/route.ts");
  assert.match(source, /searchParams\.get\("schoolId"\)/);
  assert.match(source, /searchParams\.get\("provinceId"\)/);
  assert.match(source, /searchParams\.get\("regencyId"\)/);
});

test("assigned teachers cannot use owner-only class mutations", () => {
  const source = read("src/lib/attendance-access.ts");
  assert.match(source, /if \(user\.role === "TEACHER"\) return false/);
});

test("profile completion redirects to real dashboard routes", () => {
  const source = read("src/app/dashboard/profil/page.tsx");
  assert.match(source, /from === "tugas"[\s\S]*?"\/dashboard\/tugas"/);
  assert.match(source, /from === "kelas"[\s\S]*?"\/dashboard\/kelas"/);
  assert.match(source, /from === "exam"[\s\S]*?"\/dashboard\/exam"/);
});

test("teaching profile GET is read-only and deletes stale primary state", () => {
  const getSource = read("src/app/api/profile/teaching-profiles/route.ts");
  assert.doesNotMatch(getSource.slice(0, getSource.indexOf("export async function POST")), /teacherSchoolProfile\.create/);
  const deleteSource = read("src/app/api/profile/teaching-profiles/[id]/route.ts");
  assert.match(deleteSource, /profileDefaults: Prisma\.JsonNull/);
});
