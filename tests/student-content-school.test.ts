import assert from "node:assert/strict";
import test from "node:test";
import { studentContentSchoolName } from "../src/lib/student-content-school";

test("nama sekolah karya mengutamakan relasi sekolah kelas", () => {
  assert.equal(
    studentContentSchoolName({
      school: { name: "SMA Negeri 1" },
      teacher: {
        school: { name: "Sekolah Guru" },
        teachingProfiles: [{ schoolName: "Profil Guru" }],
      },
    }),
    "SMA Negeri 1",
  );
});

test("nama sekolah karya memiliki fallback tanpa menghasilkan teks palsu", () => {
  assert.equal(
    studentContentSchoolName({
      school: null,
      teacher: {
        school: null,
        teachingProfiles: [{ schoolName: "SMP Harapan" }],
      },
    }),
    "SMP Harapan",
  );
  assert.equal(
    studentContentSchoolName({
      school: null,
      teacher: { school: null, teachingProfiles: [] },
    }),
    null,
  );
});
