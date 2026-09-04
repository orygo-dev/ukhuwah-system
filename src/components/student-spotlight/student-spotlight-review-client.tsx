"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StudentSpotlightReportsPanel } from "@/components/student-spotlight/student-spotlight-reports-panel";
import { useDashboardUser } from "@/hooks/use-dashboard-user";

export function StudentSpotlightReviewClient() {
  const dashboardUser = useDashboardUser();
  return (
    <DashboardShell activePath="/dashboard/spotlight-siswa" user={dashboardUser}>
      <StudentSpotlightReportsPanel />
    </DashboardShell>
  );
}
