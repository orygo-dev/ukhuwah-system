import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketCatalogClient } from "@/components/marketplace/market-catalog-client";

export const dynamic = "force-dynamic";

export default function DashboardMarketPage() {
  return (
    <DashboardShell activePath="/dashboard/market">
      <MarketCatalogClient basePath="/dashboard/market" />
    </DashboardShell>
  );
}
