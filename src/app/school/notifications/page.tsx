import { SchoolAdminShell } from "@/components/layout/school-admin-shell";
import { NotificationManagementClient } from "@/components/notifications/notification-management-client";
import { getCurrentSchoolAdmin } from "@/lib/school-admin";

export default async function SchoolNotificationsPage() {
  const { account } = await getCurrentSchoolAdmin("/school/notifications");
  return <SchoolAdminShell activePath="/school/notifications" accountName={account?.name} accountEmail={account?.email} schoolName={account?.school?.name}><NotificationManagementClient /></SchoolAdminShell>;
}
