import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coins,
  CreditCard,
  FileText,
  Gift,
  History,
  Handshake,
  PenLine,
  School,
  Sparkles,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TOOLS } from "@/lib/constants";
import { isTeacherProfileComplete, parseTeacherProfile } from "@/lib/teacher-profile";
import { CREDIT_LEDGER_LABELS, getRewardConfig } from "@/lib/reward";
import {
  activeSlides,
  getAppDisplayConfig,
  shouldShowBanners,
  shouldShowDesktopBanners,
} from "@/lib/app-display";
import {
  getAffiliateLeaderboard,
  getAffiliateRankSnapshot,
} from "@/lib/affiliate-insights";
import { DashboardBannerCarousel } from "@/components/dashboard/dashboard-banner-carousel";
import { CommercialDashboard } from "@/components/dashboard/commercial-dashboard";
import { DashboardMobileBannerCarousel } from "@/components/dashboard/dashboard-mobile-banner-carousel";
import { DashboardMobileProfileCard } from "@/components/dashboard/dashboard-mobile-profile-card";
import { DashboardMobileQuickMenu } from "@/components/dashboard/dashboard-mobile-quick-menu";
import { formatCurrency, formatDate } from "@/lib/utils";
import { serializeActiveMembershipPlan } from "@/lib/plan-limits";
import { productPublicDto } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function shuffleTake<T>(items: T[], count: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default async function DashboardPage() {
  const session = await auth();
  if (session?.user?.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (session?.user?.role === "SCHOOL_ADMIN") {
    redirect("/school");
  }
  if (session?.user?.role === "STUDENT") {
    redirect("/student");
  }
  const userId = session?.user?.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    user,
    todayJournalCount,
    rewardConfig,
    appDisplay,
    latestCreditLedger,
    affiliateRankSnapshot,
    affiliateLeaderboard,
    marketProductsRaw,
  ] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          include: {
            documents: { orderBy: { createdAt: "desc" }, take: 4 },
            school: { select: { name: true } },
            plan: { select: { name: true, slug: true } },
          },
        })
      : Promise.resolve(null),
    userId
      ? prisma.dailyJournal.count({
          where: { teacherId: userId, date: todayStart },
        })
      : Promise.resolve(0),
    getRewardConfig(),
    getAppDisplayConfig(),
    userId
      ? prisma.creditLedger.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 4,
        })
      : Promise.resolve([]),
    userId
      ? getAffiliateRankSnapshot(userId)
      : Promise.resolve(null),
    getAffiliateLeaderboard(5),
    prisma.marketplaceProduct.findMany({
      where: { status: "PUBLISHED", store: { status: "ACTIVE" } },
      include: {
        store: { select: { id: true, name: true, city: true, flatShippingFee: true } },
      },
      take: 60,
    }),
  ]);
  const marketSpotlight = shuffleTake(marketProductsRaw, 6).map(productPublicDto);
  const accessibleClassRooms = userId
    ? await prisma.classRoom.findMany({
        where: {
          isActive: true,
          OR: user?.schoolId
            ? [{ teacherId: userId }, { schoolId: user.schoolId }]
            : [{ teacherId: userId }],
        },
        select: { id: true, teacherId: true, schoolId: true, name: true, jenjang: true },
        orderBy: { name: "asc" },
        take: 5,
      })
    : [];
  const accessibleClassWhere = userId
    ? {
        isActive: true,
        OR: user?.schoolId
          ? [{ teacherId: userId }, { schoolId: user.schoolId }]
          : [{ teacherId: userId }],
      }
    : null;
  const accessibleClassCount = accessibleClassWhere
    ? await prisma.classRoom.count({ where: accessibleClassWhere })
    : 0;

  const credits = user?.creditsRemaining ?? 0;
  const walletBalance = Number(user?.walletBalance ?? 0);
  const classCount = accessibleClassCount;
  const quickAccessTools = TOOLS;
  const bannerSlides = activeSlides(appDisplay.banners.slides);
  const showBanners = shouldShowBanners(appDisplay);
  const desktopBannerSlides = activeSlides(appDisplay.desktopBanners.slides);
  const showDesktopBanners = shouldShowDesktopBanners(appDisplay);
  const effectiveDesktopBannerSlides = showDesktopBanners
    ? desktopBannerSlides
    : bannerSlides;
  const effectiveDesktopBannerAutoPlayMs = showDesktopBanners
    ? appDisplay.desktopBanners.autoPlayMs
    : appDisplay.banners.autoPlayMs;
  const effectiveShowDesktopBanners =
    showDesktopBanners || showBanners;
  const lowCredits =
    rewardConfig.enabled && credits <= rewardConfig.lowCreditThreshold;
  const profileIncomplete = user && !isTeacherProfileComplete(user);

  const teacherProfile = user ? parseTeacherProfile(user) : null;
  const schoolName = teacherProfile?.sekolah || user?.school?.name || "";
  const classNames = accessibleClassRooms.map((c) => c.name);
  const displayName = teacherProfile?.namaGuru || session?.user?.name || "Guru";
  const firstName = displayName.split(" ")[0] || "Guru";
  const profilePercent = profileIncomplete ? 80 : 100;
  const membershipPlan = serializeActiveMembershipPlan(
    user?.plan ?? null,
    user?.planExpiresAt
  );

  const todayTasks = [
    {
      title: "Jurnal mengajar",
      desc:
        todayJournalCount > 0
          ? `${todayJournalCount} jurnal sudah dibuat hari ini`
          : "Belum ada jurnal hari ini",
      href: todayJournalCount > 0 ? "/dashboard/jurnal" : "/dashboard/jurnal/baru",
      icon: PenLine,
      done: todayJournalCount > 0,
      action: todayJournalCount > 0 ? "Lihat jurnal" : "Tulis jurnal",
      time: "08.00",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Kelas aktif",
      desc:
        classCount > 0
          ? `${classCount} kelas siap dikelola`
          : "Tambahkan kelas untuk mulai mengelola siswa",
      href: "/dashboard/kelas",
      icon: School,
      done: classCount > 0,
      action: classCount > 0 ? "Kelola kelas" : "Tambah kelas",
      time: "10.00",
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Generator AI",
      desc: `${credits} kredit tersedia untuk membuat dokumen`,
      href: "/dashboard/tools",
      icon: Sparkles,
      done: credits > 0,
      action: "Buka generator",
      time: "13.00",
      tone: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <DashboardShell
      activePath="/dashboard"
      user={
        session?.user
          ? {
              name: session.user.name || "Guru",
              email: session.user.email || "",
              credits,
              avatarUrl: user?.avatarUrl ?? null,
              membershipPlan,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <DashboardMobileProfileCard
          name={displayName}
          avatarUrl={user?.avatarUrl}
          schoolName={schoolName}
          classNames={classNames}
          credits={credits}
          membershipPlan={membershipPlan}
        />

        <DashboardMobileQuickMenu />

        {showBanners && (
          <DashboardMobileBannerCarousel
            slides={bannerSlides}
            autoPlayMs={appDisplay.banners.autoPlayMs}
          />
        )}

        <CommercialDashboard
          firstName={firstName}
          displayName={displayName}
          credits={credits}
          walletBalance={walletBalance}
          classCount={classCount}
          currentUserId={userId ?? ""}
          todayJournalCount={todayJournalCount}
          lowCredits={lowCredits}
          membershipPlan={membershipPlan}
          tools={quickAccessTools}
          agenda={todayTasks}
          classes={accessibleClassRooms}
          documents={user?.documents ?? []}
          activities={latestCreditLedger}
          affiliateRank={affiliateRankSnapshot}
          affiliateLeaderboard={affiliateLeaderboard}
          showBanners={effectiveShowDesktopBanners}
          bannerSlides={effectiveDesktopBannerSlides}
          bannerAutoPlayMs={effectiveDesktopBannerAutoPlayMs}
          marketProducts={marketSpotlight}
        />

        {user && false && (
        <div className="hidden">
          <div className="space-y-5">
            <section
              className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white p-6 shadow-[0_24px_70px_rgba(15,76,129,0.08)]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 82% 14%, rgba(0, 102, 255, 0.14), transparent 28%), radial-gradient(circle at 52% 100%, rgba(34, 211, 238, 0.22), transparent 26%), linear-gradient(135deg, #ffffff 0%, #f8fbff 42%, #edf6ff 100%)",
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.36]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(37,99,235,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.08) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  maskImage:
                    "linear-gradient(90deg, transparent 0%, black 24%, black 82%, transparent 100%)",
                }}
              />
              <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-1/4 h-44 w-96 rounded-full bg-cyan-300/25 blur-3xl" />

              <div className="relative grid min-h-[262px] grid-cols-[minmax(0,1fr)_360px] gap-6">
                <div className="flex flex-col">
                  <p className="text-sm font-medium text-muted-foreground">
                    {shortDate(new Date())}
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                    Selamat datang, {firstName}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    Pantau kesiapan mengajar, kelola kredit, dan lanjutkan pekerjaan
                    administrasi kelas dari satu ruang kerja.
                  </p>

                  <div className="mt-auto grid max-w-xl grid-cols-3 gap-3 pt-8">
                    <div className="rounded-xl border border-emerald-100 bg-white/80 p-4 shadow-sm backdrop-blur">
                      <p className="text-xs font-medium text-muted-foreground">Kelas aktif</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{classCount}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-white/80 p-4 shadow-sm backdrop-blur">
                      <p className="text-xs font-medium text-muted-foreground">Jurnal hari ini</p>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{todayJournalCount}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-white/80 p-4 shadow-sm backdrop-blur">
                      <p className="text-xs font-medium text-muted-foreground">Status kredit</p>
                      <p className={lowCredits ? "mt-2 text-sm font-semibold text-amber-700" : "mt-2 text-sm font-semibold text-emerald-700"}>
                        {lowCredits ? "Perlu top up" : "Siap dipakai"}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="relative overflow-hidden rounded-2xl border border-white/40 bg-primary p-5 text-white shadow-[0_24px_55px_rgba(37,99,235,0.24)]"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 88% 10%, rgba(255,255,255,0.34), transparent 20%), radial-gradient(circle at 8% 92%, rgba(34,211,238,0.36), transparent 25%), linear-gradient(135deg, #075BFF 0%, #0B73F6 48%, #16B8E8 100%)",
                  }}
                >
                  <div className="pointer-events-none absolute -right-12 top-8 h-32 w-32 rounded-full border border-white/20" />
                  <div className="pointer-events-none absolute -right-5 top-20 h-20 w-20 rounded-full border border-white/15" />
                  <div className="pointer-events-none absolute left-0 top-0 h-full w-full bg-[linear-gradient(120deg,rgba(255,255,255,0.16)_0%,transparent_42%)]" />
                  <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/75">
                        Guru Wallet
                      </p>
                      <p className="mt-1 text-sm text-white/85">Saldo kredit & dompet</p>
                    </div>
                    <Badge className="border-white/25 bg-white/20 text-white shadow-sm hover:bg-white/20">
                      Aktif
                    </Badge>
                  </div>

                  <div className="mt-7 rounded-2xl bg-white/20 p-4 shadow-inner ring-1 ring-white/25 backdrop-blur">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-white/75">Kredit tersedia</p>
                        <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">{credits}</p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-primary shadow-lg shadow-blue-900/20">
                        <Coins className="h-6 w-6" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/18 px-3 py-2 ring-1 ring-white/15">
                      <div>
                        <p className="text-[11px] text-white/70">Dompet</p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(walletBalance)}</p>
                      </div>
                      <Wallet className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <Button className="h-11 bg-white text-primary shadow-sm hover:bg-white/90" asChild>
                      <Link href="/dashboard/topup">
                        <CreditCard className="h-4 w-4" />
                        Top Up
                      </Link>
                    </Button>
                    <Button className="h-11 border-white/30 bg-white/15 text-white hover:bg-white/25 hover:text-white" variant="outline" asChild>
                      <Link href="/dashboard/reward">
                        <History className="h-4 w-4" />
                        Riwayat
                      </Link>
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-white/75">
                    <span>Reward harian aktif</span>
                    <Link href="/dashboard/reward" className="font-semibold text-white">
                      Klaim kredit
                    </Link>
                  </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-5 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Akses Cepat</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Modul yang sama dengan menu Generator, tersedia langsung dari dashboard.
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/tools">
                    Semua generator
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid gap-3 xl:grid-cols-4 lg:grid-cols-3">
                {quickAccessTools.map((tool, index) => {
                  const Icon = tool.icon;
                  const tones = [
                    "bg-emerald-50 text-emerald-700",
                    "bg-emerald-50 text-emerald-700",
                    "bg-violet-50 text-violet-700",
                    "bg-orange-50 text-orange-700",
                    "bg-cyan-50 text-cyan-700",
                    "bg-indigo-50 text-indigo-700",
                    "bg-rose-50 text-rose-700",
                    "bg-amber-50 text-amber-700",
                  ];
                  const tone = tones[index % tones.length];

                  return (
                    <Link
                      key={tool.slug}
                      href={`/dashboard/tools/${tool.slug}`}
                      className="group flex min-h-[118px] flex-col rounded-xl border bg-background p-4 transition-all hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-3 line-clamp-1 text-sm font-semibold text-primary">
                        {tool.name}
                      </p>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {tool.description}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Agenda Kerja Hari Ini</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Prioritas singkat agar administrasi kelas tetap rapi.
                    </p>
                  </div>
                  <Badge variant="secondary" className="hidden lg:inline-flex">
                    <Clock3 className="mr-1 h-3 w-3" />
                    {todayTasks.filter((t) => t.done).length}/{todayTasks.length}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-xl border bg-background">
                    {todayTasks.map((task) => {
                      const Icon = task.icon;
                      return (
                        <li key={task.title}>
                          <Link
                            href={task.href}
                            className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-emerald-50/50"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${task.tone}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold">{task.title}</p>
                                {task.done && (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{task.desc}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                                {task.time}
                              </span>
                              <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">Kelas & Dokumen</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ringkasan kelas dan dokumen terbaru.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/documents">Lihat semua</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">Kelas Terbaru</p>
                      <Link href="/dashboard/kelas" className="text-xs font-medium text-primary">
                        Semua kelas
                      </Link>
                    </div>
                    {accessibleClassRooms.length ? (
                      <div className="space-y-2">
                        {accessibleClassRooms.slice(0, 2).map((room) => (
                          <Link
                            key={room.id}
                            href={`/dashboard/kelas/${room.id}`}
                            className="flex items-center gap-3 rounded-xl border bg-background p-3 transition-colors hover:bg-secondary/50"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <School className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{room.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{room.jenjang || "Kelas aktif"}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl border border-dashed bg-emerald-50/40 p-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
                          <School className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">Belum ada kelas</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Buat kelas untuk mengelola siswa.</p>
                        </div>
                        <Button size="sm" asChild>
                          <Link href="/dashboard/kelas">Buat</Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">Dokumen Terbaru</p>
                      <Link href="/dashboard/documents" className="text-xs font-medium text-primary">
                        Semua dokumen
                      </Link>
                    </div>
                    {user?.documents.length ? (
                      <ul className="divide-y rounded-xl border bg-background">
                        {user?.documents.slice(0, 3).map((doc) => (
                          <li key={doc.id}>
                            <Link
                              href={`/dashboard/documents/${doc.id}`}
                              className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/50"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-primary">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{doc.title}</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px]">
                                    {doc.toolSlug}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
                                </div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                        Belum ada dokumen terbaru.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <aside className="space-y-5">
            {showBanners ? (
              <DashboardBannerCarousel
                slides={bannerSlides}
                autoPlayMs={appDisplay.banners.autoPlayMs}
                compact
              />
            ) : (
              <div className="rounded-2xl border bg-primary p-6 text-white shadow-card">
                <p className="text-xs font-bold uppercase tracking-wide text-white/80">Baru</p>
                <h2 className="mt-4 text-xl font-bold">
                  Kumpulkan kredit harian, raih keuntungan tambahan
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/80">
                  Kerjakan aktivitas di Navalogi dan tukarkan kredit untuk fitur premium.
                </p>
                <Button size="sm" className="mt-5 bg-white text-primary hover:bg-white/90" asChild>
                  <Link href="/dashboard/reward">Lihat Selengkapnya</Link>
                </Button>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Profil</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-5">
                <div
                  className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(hsl(var(--primary)) ${profilePercent * 3.6}deg, hsl(var(--secondary)) 0deg)`,
                  }}
                >
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-card text-lg font-bold">
                    {profilePercent}%
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {profileIncomplete
                      ? "Lengkapi profil untuk pengalaman lebih optimal"
                      : schoolName || "Profil guru siap digunakan"}
                  </p>
                  <Button size="sm" variant="outline" className="mt-4" asChild>
                    <Link href="/dashboard/profil">
                      {profileIncomplete ? "Lengkapi Sekarang" : "Lihat Profil"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Aktivitas Terbaru</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/reward">Lihat semua</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {latestCreditLedger.length ? (
                  <ul className="divide-y">
                    {latestCreditLedger.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Coins className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {CREDIT_LEDGER_LABELS[row.source] || row.source} ·{" "}
                              {formatDate(row.createdAt)}
                            </p>
                          </div>
                        </div>
                        <p className={row.amount >= 0 ? "shrink-0 font-semibold text-emerald-600" : "shrink-0 font-semibold text-destructive"}>
                          {row.amount >= 0 ? "+" : ""}
                          {row.amount} kredit
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada aktivitas kredit.</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
        )}

        <div className="grid gap-4 lg:hidden lg:grid-cols-3">
          <Link
            href="/dashboard/reward"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Gift className="h-5 w-5 text-amber-600" />
            <p className="mt-3 font-semibold">Dapatkan kredit gratis</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Selesaikan misi harian untuk menambah saldo kredit.
            </p>
          </Link>
          <Link
            href="/dashboard/afiliasi"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Handshake className="h-5 w-5 text-emerald-600" />
            <p className="mt-3 font-semibold">Ajak guru lain</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Komisi afiliasi masuk ke dompet dan bisa ditarik.
            </p>
          </Link>
          <Link
            href="/dashboard/topup"
            className="rounded-xl border bg-card p-4 transition-colors hover:bg-secondary/50"
          >
            <Coins className="h-5 w-5 text-primary" />
            <p className="mt-3 font-semibold">Top up kredit</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambah kredit kapan pun tanpa mengubah paket.
            </p>
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
