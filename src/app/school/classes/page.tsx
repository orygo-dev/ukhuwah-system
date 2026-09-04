import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { SchoolClassesClient } from "@/components/school/school-classes-client";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolClassesPage() {
  const { account } = await getCurrentSchoolAdmin("/school/classes");
  const shellAccount = {
    accountName: account?.name,
    accountEmail: account?.email,
    schoolName: account?.school?.name,
  };

  if (!account?.schoolId) {
    return (
      <SchoolAdminShell activePath="/school/classes" {...shellAccount}>
        <Card className="rounded-[24px] border-amber-200 bg-amber-50">
          <CardContent className="p-6">
            <h1 className="text-xl font-extrabold text-amber-950">
              Akun admin sekolah belum terhubung ke sekolah
            </h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Hubungkan akun ini ke master data sekolah melalui Super Admin agar
              dapat mengelola kelas dan roster siswa.
            </p>
          </CardContent>
        </Card>
      </SchoolAdminShell>
    );
  }

  const schoolId = account.schoolId;
  const [teachers, classes] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TEACHER", schoolId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.classRoom.findMany({
      where: { schoolId, isActive: true },
      orderBy: [{ name: "asc" }, { tahunAjaran: "desc" }],
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        students: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          include: {
            user: { select: { email: true } },
            _count: { select: { records: true, gradeRecords: true } },
          },
        },
        _count: { select: { students: true, sessions: true } },
      },
    }),
  ]);

  return (
    <SchoolAdminShell activePath="/school/classes" {...shellAccount}>
      <Suspense fallback={<p className="text-sm text-slate-500">Memuat kelas...</p>}>
        <SchoolClassesClient
          schoolName={account.school?.name || "sekolah"}
          teachers={teachers}
          initialClasses={classes}
        />
      </Suspense>
    </SchoolAdminShell>
  );
}
