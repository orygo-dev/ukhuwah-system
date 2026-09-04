import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GENERATOR_GROUPS } from "@/lib/constants";
import { ToolCard } from "@/components/tools/tool-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { getGeneratorCatalog } from "@/lib/generator-catalog";

export const dynamic = "force-dynamic";

type ToolsPageProps = {
  searchParams?: Promise<{ category?: string }>;
};

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  const session = await auth();
  const params = await searchParams;
  const selectedCategory = params?.category || "all";
  const activeGroup = GENERATOR_GROUPS.find((group) => group.id === selectedCategory);
  const visibleGroups = activeGroup ? [activeGroup] : GENERATOR_GROUPS;
  const tools = (await getGeneratorCatalog()).filter((tool) => tool.isActive);
  const totalTools = tools.length;

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
    redirect("/dashboard/profil?required=1&from=tools");
  }

  return (
    <DashboardShell
      activePath={
        activeGroup ? `/dashboard/tools?category=${activeGroup.id}` : "/dashboard/tools"
      }
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
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.08)]">
          <div className="grid gap-5 bg-[linear-gradient(135deg,#f8fbff,#ffffff)] p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-6">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-emerald-600">AI Generator</Badge>
                <Badge variant="secondary">{totalTools} modul aktif</Badge>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                Generator Dokumen Guru
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                Pilih generator berdasarkan kebutuhan kerja guru: perangkat ajar,
                asesmen, tindak lanjut nilai, administrasi kelas, atau surat resmi.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button variant="brand" asChild>
                  <Link href="/dashboard/assistant">
                    <Sparkles className="h-4 w-4" />
                    Bantu Pilih dengan Assistant
                  </Link>
                </Button>
                <Button variant="outline" className="border-emerald-100 bg-white" asChild>
                  <Link href="/dashboard/tools">
                    Lihat Semua Generator
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-extrabold text-slate-950">Alur yang disarankan</p>
              <div className="mt-3 space-y-2">
                {["Pilih kategori", "Isi form generator", "Cek biaya kredit", "Export PDF/Word"].map(
                  (item, index) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">
                        {index + 1}
                      </span>
                      {item}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[1.25rem] border border-emerald-100 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1 text-sm font-bold text-slate-500">
            <Search className="h-4 w-4" />
            Kelompok generator
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link
              href="/dashboard/tools"
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${
                selectedCategory === "all"
                  ? "border-blue-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              Semua
            </Link>
            {GENERATOR_GROUPS.map((group) => (
              <Link
                key={group.id}
                href={`/dashboard/tools?category=${group.id}`}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${
                  selectedCategory === group.id
                    ? "border-blue-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                }`}
              >
                {group.label}
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          {visibleGroups.map((group) => {
            const groupTools = group.toolSlugs
              .map((slug) => tools.find((tool) => tool.slug === slug))
              .filter(Boolean) as typeof tools;
            if (groupTools.length === 0) return null;
            const Icon = group.icon;

            return (
              <section
                key={group.id}
                className="rounded-[1.5rem] border border-emerald-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,76,129,0.06)] sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-start gap-3">
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl ${group.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-black text-slate-950">{group.label}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{group.description}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${group.tone}`}>
                    {groupTools.length} generator
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupTools.map((tool) => (
                    <ToolCard key={tool.slug} tool={tool} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
