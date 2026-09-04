import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketProductDetailClient } from "@/components/marketplace/market-product-detail-client";

export const dynamic = "force-dynamic";

export default async function DashboardMarketProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <DashboardShell activePath="/dashboard/market">
      <MarketProductDetailClient basePath="/dashboard/market" productId={id} />
    </DashboardShell>
  );
}
