import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { MarketProductDetailClient } from "@/components/marketplace/market-product-detail-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export const dynamic = "force-dynamic";

export default async function SchoolMarketProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { account } = await getCurrentSchoolAdmin("/school/market");
  return (
    <SchoolAdminShell
      activePath="/school/market"
      accountName={account?.name}
      accountEmail={account?.email}
      schoolName={account?.school?.name}
    >
      <MarketProductDetailClient basePath="/school/market" productId={id} />
    </SchoolAdminShell>
  );
}
