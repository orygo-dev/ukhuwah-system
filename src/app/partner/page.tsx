import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner-auth";
import { PartnerDashboardClient } from "@/components/partner/partner-dashboard-client";

export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const partner = await getPartnerSession();
  if (!partner) {
    redirect("/partner/login");
  }

  return <PartnerDashboardClient />;
}
