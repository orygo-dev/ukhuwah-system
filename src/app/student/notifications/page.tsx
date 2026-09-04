import { StudentShell } from "@/components/layout/student-shell";
import { NotificationCenterClient } from "@/components/notifications/notification-center-client";

export default function StudentNotificationsPage() {
  return <StudentShell><NotificationCenterClient /></StudentShell>;
}
