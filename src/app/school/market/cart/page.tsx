import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { MarketCartClient } from "@/components/marketplace/market-cart-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolMarketCartPage() {
  const { account } = await getCurrentSchoolAdmin("/school/market/cart");
  return (
    <SchoolAdminShell
      activePath="/school/market/cart"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <MarketCartClient basePath="/school/market" />
    </SchoolAdminShell>
  );
}
