import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin");
  }
  if (session.user.role === "MERCHANT") {
    redirect("/merchant");
  }
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
