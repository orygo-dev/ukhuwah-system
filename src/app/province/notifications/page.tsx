import { ProvinceAdminShell } from "@/components/layout/province-admin-shell";
import { NotificationManagementClient } from "@/components/notifications/notification-management-client";
import { getCurrentProvinceAdmin } from "@/lib/province-admin";

export default async function ProvinceNotificationsPage() {
  const { account } = await getCurrentProvinceAdmin("/province/notifications");
  return <ProvinceAdminShell activePath="/province/notifications" accountName={account.name} accountEmail={account.email}><NotificationManagementClient /></ProvinceAdminShell>;
}
