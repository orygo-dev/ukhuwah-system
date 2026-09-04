import { Suspense } from "react";
import { RewardDashboardClient } from "@/components/reward/reward-dashboard-client";

export default function RewardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          Memuat...
        </div>
      }
    >
      <RewardDashboardClient />
    </Suspense>
  );
}
