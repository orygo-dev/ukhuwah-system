import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MerchantShell } from "@/components/layout/merchant-shell";

export const dynamic = "force-dynamic";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/merchant");
  }
  if (session.user.role !== "MERCHANT") {
    if (session.user.role === "SUPER_ADMIN") redirect("/admin");
    if (session.user.role === "SCHOOL_ADMIN") redirect("/school");
    if (session.user.role === "STUDENT") redirect("/student");
    if (session.user.role === "PROVINCE_ADMIN") redirect("/province");
    redirect("/dashboard");
  }
  const store = await prisma.merchantStore.findUnique({
    where: { userId: session.user.id },
    select: { name: true },
  });
  return <MerchantShell storeName={store?.name}>{children}</MerchantShell>;
}
