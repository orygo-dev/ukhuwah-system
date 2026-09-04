import { AdminShell } from "@/components/layout/admin-shell";
import { ContentReviewSettingsClient } from "@/components/admin/content-review-settings-client";

export default function AdminContentReviewPage() {
  return (
    <AdminShell activePath="/admin/content-review">
      <ContentReviewSettingsClient />
    </AdminShell>
  );
}
