import { AffiliateDashboardClient } from "@/components/affiliate/affiliate-dashboard-client";
import { auth } from "@/lib/auth";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AfiliasiPage() {
  const session = await auth();
  const planAccess =
    session?.user && session.user.role !== "SUPER_ADMIN"
      ? await getUserPlanEntitlements(session.user.id)
      : null;

  if (planAccess && !planAccess.entitlements.canUseAffiliate) {
    return (
      <DashboardShell activePath="/dashboard/afiliasi">
        <Card className="mx-auto max-w-3xl border-emerald-100 bg-emerald-50/60">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white">
              AF
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                Afiliasi belum aktif di paket Anda
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upgrade paket untuk membuka link referral, komisi, dan pencairan saldo afiliasi.
              </p>
            </div>
            <Button asChild variant="brand">
              <a href="/dashboard/billing">Lihat Paket Langganan</a>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return <AffiliateDashboardClient />;
}
