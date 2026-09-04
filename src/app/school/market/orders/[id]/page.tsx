import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { MarketOrderDetailClient } from "@/components/marketplace/market-order-detail-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolMarketOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { account } = await getCurrentSchoolAdmin("/school/market/orders");
  return (
    <SchoolAdminShell
      activePath="/school/market/orders"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <MarketOrderDetailClient basePath="/school/market" orderId={id} />
    </SchoolAdminShell>
  );
}
