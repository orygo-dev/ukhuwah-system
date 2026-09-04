import { redirect } from "next/navigation";
import { AdminAccountSecurityClient } from "@/components/admin/admin-account-security-client";
import { AdminShell } from "@/components/layout/admin-shell";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/account");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <AdminShell activePath="/admin/account">
      <AdminAccountSecurityClient
        name={session.user.name}
        email={session.user.email}
      />
    </AdminShell>
  );
}
