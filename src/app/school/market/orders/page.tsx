import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { MarketOrdersClient } from "@/components/marketplace/market-orders-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolMarketOrdersPage() {
  const { account } = await getCurrentSchoolAdmin("/school/market/orders");
  return (
    <SchoolAdminShell
      activePath="/school/market/orders"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <MarketOrdersClient basePath="/school/market" />
    </SchoolAdminShell>
  );
}
