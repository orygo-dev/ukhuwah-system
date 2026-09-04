import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { SchoolAdministrationClient } from "@/components/school/school-administration-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export default async function SchoolAdministrationPage() {
  const { account } = await getCurrentSchoolAdmin("/school/administration");
  return (
    <SchoolAdminShell activePath="/school/administration" accountName={account?.name} accountEmail={account?.email} schoolName={account?.school?.name}>
      <SchoolAdministrationClient />
    </SchoolAdminShell>
  );
}
