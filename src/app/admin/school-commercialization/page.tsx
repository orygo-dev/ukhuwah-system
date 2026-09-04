import { AdminShell } from "@/components/layout/admin-shell";
import { SchoolCommercializationAdminClient } from "@/components/admin/school-commercialization-admin-client";

export default function SchoolCommercializationAdminPage() {
  return <AdminShell activePath="/admin/school-commercialization"><SchoolCommercializationAdminClient /></AdminShell>;
}
