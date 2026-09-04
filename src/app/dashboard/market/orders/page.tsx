import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketOrdersClient } from "@/components/marketplace/market-orders-client";

export const dynamic = "force-dynamic";

export default function DashboardMarketOrdersPage() {
  return (
    <DashboardShell activePath="/dashboard/market/orders">
      <MarketOrdersClient basePath="/dashboard/market" />
    </DashboardShell>
  );
}
