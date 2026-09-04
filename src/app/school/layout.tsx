import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/school");
  }
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (session.user.role === "STUDENT") {
    redirect("/student");
  }
  if (session.user.role === "MERCHANT") {
    redirect("/merchant");
  }
  if (session.user.role !== "SCHOOL_ADMIN") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
