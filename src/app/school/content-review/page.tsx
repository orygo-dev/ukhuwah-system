import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { SchoolContentReviewClient } from "@/components/school/school-content-review-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolContentReviewPage() {
  const { account } = await getCurrentSchoolAdmin("/school/content-review");
  return (
    <SchoolAdminShell
      activePath="/school/content-review"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <SchoolContentReviewClient />
    </SchoolAdminShell>
  );
}
