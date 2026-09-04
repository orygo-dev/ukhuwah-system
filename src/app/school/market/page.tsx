import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { MarketCatalogClient } from "@/components/marketplace/market-catalog-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolMarketPage() {
  const { account } = await getCurrentSchoolAdmin("/school/market");
  return (
    <SchoolAdminShell
      activePath="/school/market"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <MarketCatalogClient basePath="/school/market" />
    </SchoolAdminShell>
  );
}
