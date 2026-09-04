import { AdminShell } from "@/components/layout/admin-shell";
import { StudentOnlinePanel } from "@/components/student/student-online-panel";

export const dynamic = "force-dynamic";
export default function AdminOnlineStudentsPage() {
  return <AdminShell activePath="/admin/siswa-online"><StudentOnlinePanel scopeLabel="Pantau siswa berakun aktif dari seluruh sekolah." /></AdminShell>;
}
