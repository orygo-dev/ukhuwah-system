import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { StudentOnlinePanel } from "@/components/student/student-online-panel";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";
export default async function SchoolOnlineStudentsPage() {
  const { account } = await getCurrentSchoolAdmin("/school/siswa-online");
  return <SchoolAdminShell activePath="/school/siswa-online" accountName={account?.name}
    accountEmail={account?.email} schoolName={account?.school?.name}>
    {account?.schoolId ? <StudentOnlinePanel scopeLabel="Hanya siswa di sekolah Anda yang dapat dilihat." /> :
      <p>Akun admin belum terhubung ke sekolah. Hubungi Super Admin.</p>}
  </SchoolAdminShell>;
}
