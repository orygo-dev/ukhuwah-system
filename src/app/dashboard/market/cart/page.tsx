import { DashboardShell } from "@/components/layout/dashboard-shell";
import { MarketCartClient } from "@/components/marketplace/market-cart-client";

export const dynamic = "force-dynamic";

export default function DashboardMarketCartPage() {
  return (
    <DashboardShell activePath="/dashboard/market/cart">
      <MarketCartClient basePath="/dashboard/market" />
    </DashboardShell>
  );
}
