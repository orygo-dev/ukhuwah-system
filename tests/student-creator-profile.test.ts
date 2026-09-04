import assert from "node:assert/strict";
import test from "node:test";
import { publicStudentCreatorIdentity } from "../src/lib/student-creator-profile";

test("profil kreator hanya memproyeksikan identitas publik", () => {
  const publicIdentity = publicStudentCreatorIdentity({
    id: "student-1",
    name: "Alya Putri",
    avatarUrl: "/uploads/avatars/alya.webp",
    schoolName: "SMA Negeri Demo",
    className: "  XI IPA 1  ",
  });

  assert.deepEqual(Object.keys(publicIdentity).sort(), [
    "avatarUrl",
    "className",
    "id",
    "name",
    "schoolName",
  ]);
  assert.equal(publicIdentity.className, "XI IPA 1");
  assert.equal("email" in publicIdentity, false);
  assert.equal("nisn" in publicIdentity, false);
  assert.equal("phone" in publicIdentity, false);
  assert.equal("classRoom" in publicIdentity, false);
});

test("profil kreator memberi fallback sekolah yang konsisten", () => {
  const publicIdentity = publicStudentCreatorIdentity({
    id: "student-2",
    name: "Bima",
    avatarUrl: null,
    schoolName: " ",
  });
  assert.equal(publicIdentity.schoolName, "Sekolah belum tercantum");
  assert.equal(publicIdentity.className, null);
});
