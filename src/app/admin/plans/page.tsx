import { AdminShell } from "@/components/layout/admin-shell";
import { AdminPlansClient } from "@/components/admin/admin-plans-client";

export const dynamic = "force-dynamic";

export default function AdminPlansPage() {
  return (
    <AdminShell activePath="/admin/plans">
      <AdminPlansClient />
    </AdminShell>
  );
}
