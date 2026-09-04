/**
 * Audit direktori member.
 * Jalankan: npx tsx scripts/audit-members.ts
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { serializeMember } from "../src/lib/member-directory";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const teachers = await prisma.user.findMany({
    where: { role: UserRole.TEACHER },
    include: {
      school: true,
      plan: { select: { name: true, slug: true } },
      classRooms: { where: { isActive: true } },
    },
  });

  checks.push({
    name: "Ada guru terdaftar",
    ok: teachers.length >= 5,
    detail: `count=${teachers.length}`,
  });

  const members = teachers.map(serializeMember);
  const withSchool = members.filter((m) => m.schoolName !== "Sekolah belum diisi");
  checks.push({
    name: "Member punya data sekolah",
    ok: withSchool.length >= 5,
    detail: `${withSchool.length} dengan sekolah`,
  });

  const withMapel = members.filter((m) => m.mapel !== "—");
  checks.push({
    name: "Member punya mata pelajaran",
    ok: withMapel.length >= 5,
    detail: `${withMapel.length} dengan mapel`,
  });

  const withClasses = members.filter((m) => m.classes.length > 0);
  checks.push({
    name: "Member punya kelas",
    ok: withClasses.length >= 4,
    detail: `${withClasses.length} dengan kelas`,
  });

  const demo = members.find((m) => m.name.includes("Sinta"));
  checks.push({
    name: "Demo guru Bu Sinta ada di direktori",
    ok: !!demo,
    detail: demo ? `${demo.mapel} · ${demo.classes.map((c) => c.name).join(", ")}` : "missing",
  });

  const seeded = members.find((m) => m.name.includes("Rina"));
  checks.push({
    name: "Seed member Bu Rina ada",
    ok: !!seeded && seeded.classes.length >= 2,
    detail: seeded
      ? `${seeded.schoolName} · kelas: ${seeded.classes.map((c) => c.name).join(", ")}`
      : "missing",
  });

  const search = members.filter((m) =>
    m.mapel.toLowerCase().includes("ipa")
  );
  checks.push({
    name: "Filter mapel berfungsi (logika)",
    ok: search.length >= 1,
    detail: `ipa: ${search.map((m) => m.name).join(", ")}`,
  });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n=== Audit Member ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed++;
    console.log(`[${mark}] ${c.name}`);
    console.log(`       ${c.detail}\n`);
  }
  console.log(failed === 0 ? "Semua cek lulus.\n" : `${failed} cek gagal.\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
