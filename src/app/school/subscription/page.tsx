import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { SchoolSubscriptionClient } from "@/components/school/school-subscription-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export default async function SchoolSubscriptionPage() {
  const { account } = await getCurrentSchoolAdmin("/school/subscription");
  return (
    <SchoolAdminShell activePath="/school/subscription" accountName={account?.name} accountEmail={account?.email} schoolName={account?.school?.name}>
      <SchoolSubscriptionClient />
    </SchoolAdminShell>
  );
}
