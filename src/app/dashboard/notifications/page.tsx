import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NotificationManagementClient } from "@/components/notifications/notification-management-client";

export default function TeacherNotificationsPage() {
  return <DashboardShell activePath="/dashboard/notifications"><NotificationManagementClient /></DashboardShell>;
}
