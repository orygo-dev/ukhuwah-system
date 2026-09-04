import { AdminShell } from "@/components/layout/admin-shell";
import { LiveKitSettingsClient } from "@/components/admin/livekit-settings-client";

export default function AdminLiveKitPage() {
  return (
    <AdminShell activePath="/admin/livekit">
      <LiveKitSettingsClient />
    </AdminShell>
  );
}
