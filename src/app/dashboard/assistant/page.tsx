import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AssistantWorkflowClient } from "@/components/assistant/assistant-workflow-client";
import { ASSISTANT_WORKFLOWS } from "@/lib/assistant-workflows";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  isTeacherProfileComplete,
  profileToFormDefaults,
} from "@/lib/teacher-profile";
import { getGeneratorCatalog } from "@/lib/generator-catalog";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const session = await auth();

  const user =
    session?.user && session.user.role !== "SUPER_ADMIN"
      ? await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            name: true,
            nip: true,
            phone: true,
            profileDefaults: true,
            creditsRemaining: true,
          },
        })
      : null;

  if (user && !isTeacherProfileComplete(user)) {
    redirect("/dashboard/profil?required=1&from=assistant");
  }

  const planAccess =
    session?.user && session.user.role !== "SUPER_ADMIN"
      ? await getUserPlanEntitlements(session.user.id)
      : null;

  const documents = session?.user
    ? await prisma.document.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          title: true,
          toolSlug: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const generatorTools = await getGeneratorCatalog();
  const toolConfigs = Object.fromEntries(
    generatorTools.map((tool) => [
      tool.slug,
      { creditCost: tool.creditCost, isActive: tool.isActive },
    ])
  );

  return (
    <DashboardShell
      activePath="/dashboard/assistant"
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
      {planAccess && !planAccess.entitlements.canUseAiAssistant ? (
        <Card className="mx-auto max-w-3xl border-emerald-100 bg-emerald-50/60">
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-600 text-white">
              AI
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-950">
                AI Assistant belum aktif di paket Anda
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Upgrade paket untuk memakai workflow assistant, rekomendasi dokumen, dan
                estimasi biaya sebelum generate.
              </p>
            </div>
            <Button asChild variant="brand">
              <a href="/dashboard/billing">Lihat Paket Langganan</a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <AssistantWorkflowClient
          workflows={ASSISTANT_WORKFLOWS}
          documents={documents.map((document) => ({
            ...document,
            status: document.status,
            createdAt: document.createdAt.toISOString(),
          }))}
          creditsRemaining={user?.creditsRemaining ?? session?.user?.creditsRemaining ?? 0}
          profileDefaults={user ? profileToFormDefaults(user) : {}}
          toolConfigs={toolConfigs}
        />
      )}
    </DashboardShell>
  );
}
