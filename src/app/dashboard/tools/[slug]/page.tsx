import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DocumentGenerator } from "@/components/tools/document-generator";
import {
  isTeacherProfileComplete,
  profileToFormDefaults,
} from "@/lib/teacher-profile";
import { getGeneratorTool, toToolData } from "@/lib/generator-catalog";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = await getGeneratorTool(slug);
  if (!tool) notFound();
  if (!tool.isActive) redirect("/dashboard/tools?inactive=1");

  const session = await auth();
  const user = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          nip: true,
          phone: true,
          creditsRemaining: true,
          profileDefaults: true,
        },
      })
    : null;

  if (
    session?.user?.role !== "SUPER_ADMIN" &&
    user &&
    !isTeacherProfileComplete(user)
  ) {
    redirect(`/dashboard/profil?required=1&from=${slug}`);
  }

  const defaults = user ? profileToFormDefaults(user) : {};

  const toolData = toToolData(tool);

  return (
    <DashboardShell
      activePath={`/dashboard/tools/${slug}`}
      user={
        session?.user
          ? {
              name: session.user.name || "Guru",
              email: session.user.email || "",
              credits: user?.creditsRemaining ?? session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <DocumentGenerator
        tool={toolData}
        creditsRemaining={user?.creditsRemaining ?? 0}
        defaults={defaults}
      />
    </DashboardShell>
  );
}
