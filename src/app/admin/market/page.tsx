import { AdminShell } from "@/components/layout/admin-shell";
import { AdminMarketClient } from "@/components/admin/admin-market-client";

export const dynamic = "force-dynamic";

export default function AdminMarketPage() {
  return (
    <AdminShell activePath="/admin/market">
      <AdminMarketClient />
    </AdminShell>
  );
}
