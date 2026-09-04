import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StudentAccountsClient } from "@/components/classes/student-accounts-client";

export const dynamic = "force-dynamic";

export default async function StudentAccountsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    redirect("/dashboard");
  }

  return <StudentAccountsClient />;
}
