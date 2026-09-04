import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { ProvincePjjClient } from "@/components/pjj/province-pjj-client";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";

export default async function ProvincePjjPage() {
  const { account } = await getCurrentProvinceAdmin("/province/pjj");
  return (
    <ProvinceAdminShell
      activePath="/province/pjj"
      accountName={account.name}
      accountEmail={account.email}
    >
      <ProvincePjjClient />
    </ProvinceAdminShell>
  );
}
