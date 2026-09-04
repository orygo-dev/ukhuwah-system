import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketOrderDetailClient } from "@/components/marketplace/market-order-detail-client";

export const dynamic = "force-dynamic";

export default async function DashboardMarketOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DashboardShell activePath="/dashboard/market/orders">
      <MarketOrderDetailClient basePath="/dashboard/market" orderId={id} />
    </DashboardShell>
  );
}
