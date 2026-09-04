import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { SchoolPjjClient } from "@/components/pjj/school-pjj-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export default async function SchoolPjjPage() {
  const { account } = await getCurrentSchoolAdmin("/school/pjj");
  return (
    <SchoolAdminShell
      activePath="/school/pjj"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <SchoolPjjClient hasSchool={Boolean(account?.schoolId)} />
    </SchoolAdminShell>
  );
}
