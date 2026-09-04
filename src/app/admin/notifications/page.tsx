import { AdminShell } from "@/components/layout/admin-shell";
import { NotificationManagementClient } from "@/components/notifications/notification-management-client";

export default function AdminNotificationsPage() {
  return <AdminShell activePath="/admin/notifications"><NotificationManagementClient /></AdminShell>;
}
