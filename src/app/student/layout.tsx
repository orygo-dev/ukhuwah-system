import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StudentPresenceHeartbeat } from "@/components/student/student-presence-heartbeat";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/student");
  }
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (session.user.role === "SCHOOL_ADMIN") {
    redirect("/school");
  }
  if (session.user.role === "MERCHANT") {
    redirect("/merchant");
  }
  if (session.user.role !== "STUDENT") {
    redirect("/dashboard");
  }

  return <><StudentPresenceHeartbeat />{children}</>;
}
