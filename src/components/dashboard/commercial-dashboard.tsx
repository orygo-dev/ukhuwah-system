import Link from "next/link";
import {
  ArrowRight,
  Award,
  Coins,
  FileText,
  History,
  Plus,
  School,
  ShoppingBag,
  Star,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Tool } from "@/lib/constants";
import type { MediaSlide } from "@/lib/app-display.shared";
import type {
  AffiliateLeaderboardEntry,
  AffiliateRankSnapshot,
} from "@/lib/affiliate-insights";
import { CREDIT_LEDGER_LABELS } from "@/lib/reward";
import { PRODUCT_KIND_LABELS, type ProductKind } from "@/lib/marketplace.shared";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardBannerCarousel } from "@/components/dashboard/dashboard-banner-carousel";

type AgendaItem = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
  time: string;
  tone: string;
};

type ClassItem = {
  id: string;
  teacherId: string;
  schoolId?: string | null;
  name: string;
  jenjang: string | null;
};

type DocumentItem = {
  id: string;
  title: string;
  toolSlug: string;
  createdAt: Date;
};

type CreditActivity = {
  id: string;
  description: string;
  source: string;
  amount: number;
  createdAt: Date;
};

type MembershipPlan = {
  name: string;
  slug: string;
  expiresAt?: string | null;
} | null;

type MarketSpotlightProduct = {
  id: string;
  title: string;
  kind: ProductKind;
  price: number;
  imageUrl: string | null;
  store: { name: string; city: string | null };
};

type CommercialDashboardProps = {
  firstName: string;
  displayName: string;
  credits: number;
  walletBalance: number;
  classCount: number;
  currentUserId: string;
  todayJournalCount: number;
  lowCredits: boolean;
  membershipPlan: MembershipPlan;
  tools: Tool[];
  agenda: AgendaItem[];
  classes: ClassItem[];
  documents: DocumentItem[];
  activities: CreditActivity[];
  affiliateRank: AffiliateRankSnapshot | null;
  affiliateLeaderboard: AffiliateLeaderboardEntry[];
  showBanners: boolean;
  bannerSlides: MediaSlide[];
  bannerAutoPlayMs: number;
  marketProducts: MarketSpotlightProduct[];
};

const rankBadgeClasses: Record<string, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  blue: "border-emerald-200 bg-emerald-50 text-emerald-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

function RankBadge({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold leading-none",
        rankBadgeClasses[color] ?? rankBadgeClasses.blue,
        className
      )}
    >
      <Award className="h-3 w-3" />
      {name}
    </span>
  );
}

const toolTones = [
  {
    card: "bg-emerald-50 border-emerald-100 hover:border-emerald-200 hover:shadow-emerald-100/80",
    icon: "bg-white text-emerald-700",
    accent: "from-emerald-400/25 to-emerald-400/0",
  },
  {
    card: "bg-violet-50 border-violet-100 hover:border-violet-200 hover:shadow-violet-100/80",
    icon: "bg-white text-violet-700",
    accent: "from-violet-400/25 to-violet-400/0",
  },
  {
    card: "bg-emerald-50 border-emerald-100 hover:border-emerald-200 hover:shadow-emerald-100/80",
    icon: "bg-white text-emerald-700",
    accent: "from-emerald-400/25 to-emerald-400/0",
  },
  {
    card: "bg-sky-50 border-sky-100 hover:border-sky-200 hover:shadow-sky-100/80",
    icon: "bg-white text-sky-700",
    accent: "from-sky-400/25 to-sky-400/0",
  },
  {
    card: "bg-cyan-50 border-cyan-100 hover:border-cyan-200 hover:shadow-cyan-100/80",
    icon: "bg-white text-cyan-700",
    accent: "from-cyan-400/25 to-cyan-400/0",
  },
  {
    card: "bg-indigo-50 border-indigo-100 hover:border-indigo-200 hover:shadow-indigo-100/80",
    icon: "bg-white text-indigo-700",
    accent: "from-indigo-400/25 to-indigo-400/0",
  },
  {
    card: "bg-rose-50 border-rose-100 hover:border-rose-200 hover:shadow-rose-100/80",
    icon: "bg-white text-rose-700",
    accent: "from-rose-400/25 to-rose-400/0",
  },
  {
    card: "bg-teal-50 border-teal-100 hover:border-teal-200 hover:shadow-teal-100/80",
    icon: "bg-white text-teal-700",
    accent: "from-teal-400/25 to-teal-400/0",
  },
  {
    card: "bg-emerald-50 border-emerald-100 hover:border-emerald-200 hover:shadow-emerald-100/80",
    icon: "bg-white text-emerald-700",
    accent: "from-emerald-400/25 to-emerald-400/0",
  },
  {
    card: "bg-orange-50 border-orange-100 hover:border-orange-200 hover:shadow-orange-100/80",
    icon: "bg-white text-orange-700",
    accent: "from-orange-400/25 to-orange-400/0",
  },
];

const quickAccessSummaries: Record<string, string> = {
  "modul-ajar": "Susun perangkat ajar",
  prota: "Rencana tahunan",
  prosem: "Rencana semester",
  lkpd: "Lembar kerja siswa",
  silabus: "Alur materi kelas",
  "bank-soal": "Buat soal otomatis",
  rubrik: "Kriteria penilaian",
  "narasi-rapor": "Narasi siap pakai",
  "jurnal-mengajar": "Catatan mengajar",
  "surat-dinas": "Dokumen resmi",
};

function GuruWalletCard({
  credits,
  walletBalance,
  membershipPlan,
}: Pick<
  CommercialDashboardProps,
  "credits" | "walletBalance" | "membershipPlan"
>) {
  const memberName = membershipPlan?.name ?? "Free";
  const memberActive = !!membershipPlan?.slug && membershipPlan.slug !== "free";

  return (
    <section
      className="relative isolate overflow-hidden rounded-2xl border border-emerald-200/70 bg-[linear-gradient(135deg,#047857_0%,#059669_54%,#14b8a6_100%)] p-4 text-white shadow-[0_18px_44px_rgba(5,150,105,0.16)]"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/35" />
      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold">Guru Wallet</h2>
            <p className="text-[11px] font-medium text-white/70">
              Kredit, dompet &amp; paket
            </p>
          </div>
          <Badge
            className={cn(
              "border border-white/20 px-2 py-0.5 text-[10px] font-extrabold shadow-sm",
              memberActive
                ? "bg-white text-primary hover:bg-white"
                : "bg-white/15 text-white hover:bg-white/15"
            )}
          >
            {memberName}
          </Badge>
        </div>

        {/* Kredit + Dompet inline */}
        <div className="mt-3 rounded-xl bg-white/14 px-3 py-3 shadow-inner ring-1 ring-white/20 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-md shadow-blue-950/20">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">
                  Kredit
                </p>
                <p className="text-2xl font-extrabold leading-none tabular-nums">
                  {credits}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/16 ring-1 ring-white/18">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/65">
                  Dompet
                </p>
                <p className="text-base font-extrabold leading-none tabular-nums">
                  {formatCurrency(walletBalance)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button className="h-8 rounded-lg bg-white text-xs text-primary shadow-sm hover:bg-white/90" asChild>
            <Link href="/dashboard/topup">
              <Plus className="h-3.5 w-3.5" />
              Top Up
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-8 rounded-lg border-white/24 bg-white/10 text-xs text-white hover:bg-white/18 hover:text-white"
            asChild
          >
            <Link href="/dashboard/reward">
              <History className="h-3.5 w-3.5" />
              Riwayat
            </Link>
          </Button>
        </div>

        {/* Reward row */}
        <Link
          href="/dashboard/reward"
          className="mt-2.5 flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-[11px] ring-1 ring-white/12 transition-colors hover:bg-white/16"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold text-white/88">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
            Reward harian aktif
          </span>
          <span className="font-extrabold text-white">Klaim →</span>
        </Link>
      </div>
    </section>
  );
}

function QuickAccessGrid({ tools }: { tools: Tool[] }) {
  const visibleTools = tools.slice(0, 6);

  return (
    <section className="rounded-[18px] border border-emerald-100 bg-white p-4 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-slate-950">Akses Cepat</h2>
        <Button size="sm" className="rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90" asChild>
          <Link href="/dashboard/tools">
            Tampilkan semua generator
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-3">
        {visibleTools.map((tool, index) => {
          const Icon = tool.icon;
          const tone = toolTones[index % toolTones.length];
          return (
            <Link
              key={tool.slug}
              href={`/dashboard/tools/${tool.slug}`}
              className={cn(
                "group relative flex min-h-[130px] min-w-0 flex-col overflow-hidden rounded-[14px] border p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                tone.card
              )}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b",
                  tone.accent
                )}
              />
              <div className="relative flex items-start justify-between">
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl shadow-sm", tone.icon)}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                {tool.popular ? (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold leading-none text-amber-600 ring-1 ring-amber-100">
                    Populer
                  </span>
                ) : null}
              </div>
              <p className="relative mt-3 min-h-[34px] text-[13px] font-extrabold leading-[17px] text-slate-950">
                {tool.name}
              </p>
              <p className="relative mt-auto pt-2 text-[11px] font-medium leading-[15px] text-slate-500">
                {quickAccessSummaries[tool.slug] ?? tool.description}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function MarketplaceSpotlightCard({ products }: { products: MarketSpotlightProduct[] }) {
  return (
    <section className="rounded-[18px] border border-emerald-100 bg-white p-4 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">Marketplace</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Produk pilihan berganti setiap kali Anda membuka dashboard
          </p>
        </div>
        <Button size="sm" className="rounded-lg bg-teal-600 text-white shadow-sm hover:bg-teal-700" asChild>
          <Link href="/dashboard/market">
            Tampilkan semua produk marketplace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {products.length ? (
        <div className="mt-4 grid grid-cols-6 gap-3">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/dashboard/market/${product.id}`}
              className="group overflow-hidden rounded-[14px] border border-emerald-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="relative h-28 overflow-hidden bg-gradient-to-br from-emerald-50 to-cyan-50">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ShoppingBag className="h-8 w-8 text-emerald-200" />
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-sm">
                  {PRODUCT_KIND_LABELS[product.kind]}
                </span>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 min-h-[34px] text-[13px] font-extrabold leading-[17px] text-slate-950">
                  {product.title}
                </p>
                <p className="mt-1 truncate text-[11px] font-medium text-slate-500">
                  {product.store.name}
                  {product.store.city ? ` · ${product.store.city}` : ""}
                </p>
                <p className="mt-2 text-sm font-black text-primary">{formatCurrency(product.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 px-4 py-8 text-center text-sm text-slate-500">
          Belum ada produk marketplace yang tersedia.
        </div>
      )}
    </section>
  );
}

function AgendaCard({ agenda }: { agenda: AgendaItem[] }) {
  return (
    <section className="flex flex-col rounded-[18px] border border-emerald-100 bg-white p-4 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
      <div className="flex items-center justify-between border-b border-blue-50 pb-3">
        <h2 className="text-base font-extrabold text-slate-950">Agenda Kerja Hari Ini</h2>
        <Link href="/dashboard/jurnal" className="text-xs font-semibold text-primary">
          Lihat semua
        </Link>
      </div>
      <ul className="divide-y divide-blue-50">
        {agenda.map((task, index) => {
          const Icon = task.icon;
          const status = task.done ? "Selesai" : index === 2 ? "Proses" : "Belum";
          return (
            <li key={task.title}>
              <Link href={task.href} className="flex items-center gap-3 py-3.5">
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", task.tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-slate-950">{task.title}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{task.desc}</p>
                </div>
                <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold tabular-nums text-primary">
                  {task.time}
                </span>
                <span
                  className={cn(
                    "min-w-16 rounded-lg px-3 py-1 text-center text-xs font-semibold",
                    task.done
                      ? "bg-emerald-50 text-emerald-700"
                      : index === 2
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500"
                  )}
                >
                  {status}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClassDocumentCard({
  classes,
  documents,
  currentUserId,
}: {
  classes: ClassItem[];
  documents: DocumentItem[];
  currentUserId: string;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-emerald-100 bg-white p-4 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
      <h2 className="text-base font-extrabold text-slate-950">Kelas & Dokumen</h2>
      <div className="mt-3 flex gap-5 border-b border-blue-50 text-sm">
        <span className="border-b-2 border-primary pb-2 font-extrabold text-primary">Kelas Terbaru</span>
        <span className="pb-2 font-semibold text-slate-500">Dokumen Terbaru</span>
      </div>

      {classes.length ? (
        <div className="mt-4 space-y-2">
          {classes.slice(0, 2).map((room) => {
            const ownedByMe = room.teacherId === currentUserId;
            const label = ownedByMe ? "Dikelola saya" : room.schoolId ? "Kelas sekolah" : "Kelas pribadi";
            return (
              <Link
                key={room.id}
                href={`/dashboard/kelas/${room.id}`}
                className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-primary">
                  <School className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-slate-950">{room.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{room.jenjang || "Kelas aktif"}</p>
                </div>
                <Badge
                  variant={ownedByMe ? "default" : "secondary"}
                  className={ownedByMe ? "shrink-0 bg-emerald-600 text-white" : "shrink-0"}
                >
                  {label}
                </Badge>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-slate-950">Belum ada kelas terbaru</p>
            <p className="mt-1 text-xs text-slate-500">Kelas sekolah akan muncul otomatis jika sudah disiapkan admin</p>
          </div>
          <Button size="sm" className="rounded-lg" asChild>
            <Link href="/dashboard/kelas">
              <Plus className="h-4 w-4" />
              Buat Kelas Baru
            </Link>
          </Button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {documents.slice(0, 5).map((doc) => (
          <li key={doc.id}>
            <Link href={`/dashboard/documents/${doc.id}`} className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-emerald-50/60">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{doc.title}</p>
              <Badge variant="secondary" className="text-[10px]">
                {doc.toolSlug}
              </Badge>
              <span className="w-20 text-right text-xs text-slate-500">{formatDate(doc.createdAt)}</span>
            </Link>
          </li>
        ))}
        {!documents.length && (
          <li className="rounded-lg border border-dashed p-3 text-xs text-slate-500">
            Belum ada dokumen terbaru.
          </li>
        )}
      </ul>
    </section>
  );
}

function AffiliateLeaderboardCard({
  currentRank,
  entries,
  className,
}: {
  currentRank: AffiliateRankSnapshot | null;
  entries: AffiliateLeaderboardEntry[];
  className?: string;
}) {
  const topEntries = entries.slice(0, 5);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[18px] border border-emerald-100 bg-white shadow-[0_14px_42px_rgba(15,76,129,0.06)]",
        className
      )}
    >
      <div className="border-b border-blue-50 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-950">Top Rank Affiliate</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Peringkat guru berdasarkan jumlah referral.
            </p>
          </div>
          {currentRank ? (
            <RankBadge name={currentRank.rank.name} color={currentRank.rank.color} />
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-100 bg-white/85 p-3">
            <p className="text-[11px] font-semibold text-slate-500">Referral Anda</p>
            <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-950">
              {currentRank?.referralCount ?? 0}
            </p>
          </div>
          <Link
            href="/dashboard/afiliasi"
            className="rounded-xl border border-emerald-100 bg-primary p-3 text-white shadow-sm shadow-primary/20"
          >
            <p className="text-[11px] font-semibold text-white/75">Program</p>
            <p className="mt-1 text-sm font-extrabold">Afiliasi</p>
          </Link>
        </div>
      </div>

      <div className="p-4">
        {topEntries.length ? (
          <ul className="space-y-3">
            {topEntries.map((entry, index) => (
              <li key={entry.userId} className="flex items-center gap-3">
                <div
                  className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold",
                    index === 0
                      ? "bg-yellow-100 text-yellow-700"
                      : index === 1
                        ? "bg-slate-100 text-slate-700"
                        : index === 2
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-50 text-primary"
                  )}
                >
                  {index + 1}
                </div>
                <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-extrabold text-primary">
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.avatarUrl}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    entry.name.charAt(0)
                  )}
                  <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-white bg-amber-400 text-white">
                    <Award className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-slate-950">
                      {entry.name}
                    </p>
                    <RankBadge
                      name={entry.rank.name}
                      color={entry.rank.color}
                      className="hidden xl:inline-flex"
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.referralCount} referral · {formatCurrency(entry.commissionTotal)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-sm text-slate-600">
            Belum ada peringkat affiliate. Bagikan link afiliasi untuk mulai naik rank.
          </div>
        )}
      </div>
    </section>
  );
}

function DashboardBannerBlock({
  showBanners,
  bannerSlides,
  bannerAutoPlayMs,
}: Pick<
  CommercialDashboardProps,
  | "showBanners"
  | "bannerSlides"
  | "bannerAutoPlayMs"
>) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-emerald-100 bg-white shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
      {showBanners && bannerSlides.length ? (
        <DashboardBannerCarousel
          slides={bannerSlides}
          autoPlayMs={bannerAutoPlayMs}
          compact
          fit="cover"
          aspect="desktop"
          showCaption={false}
          className="rounded-[18px] border-0"
        />
      ) : (
        <div className="aspect-[16/5] w-full bg-gradient-to-br from-emerald-50 to-cyan-50" />
      )}
    </section>
  );
}

function RightRail({
  credits,
  walletBalance,
  membershipPlan,
  activities,
  affiliateRank,
  affiliateLeaderboard,
}: Pick<
  CommercialDashboardProps,
  | "credits"
  | "walletBalance"
  | "membershipPlan"
  | "activities"
  | "affiliateRank"
  | "affiliateLeaderboard"
>) {
  return (
    <aside className="space-y-5">
      <GuruWalletCard
        credits={credits}
        walletBalance={walletBalance}
        membershipPlan={membershipPlan}
      />

      <AffiliateLeaderboardCard
        currentRank={affiliateRank}
        entries={affiliateLeaderboard}
      />

      <section className="rounded-[18px] border border-emerald-100 bg-white p-5 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-950">Aktivitas Terbaru</h2>
          <Link href="/dashboard/reward" className="text-xs font-semibold text-primary">
            Lihat semua
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-blue-50">
          {activities.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
                <Coins className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{row.description}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {CREDIT_LEDGER_LABELS[row.source] || row.source} · {formatDate(row.createdAt)}
                </p>
              </div>
              <span className={cn("text-sm font-extrabold", row.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {row.amount >= 0 ? "+" : ""}
                {row.amount} kredit
              </span>
            </li>
          ))}
          {!activities.length && (
            <li className="py-4 text-sm text-slate-500">Belum ada aktivitas kredit.</li>
          )}
        </ul>
      </section>
    </aside>
  );
}

function RightRailBottom({
  activities,
  affiliateRank,
  affiliateLeaderboard,
}: Pick<
  CommercialDashboardProps,
  | "activities"
  | "affiliateRank"
  | "affiliateLeaderboard"
>) {
  return (
    <aside className="space-y-5">
      <AffiliateLeaderboardCard
        currentRank={affiliateRank}
        entries={affiliateLeaderboard}
      />

      <section className="rounded-[18px] border border-emerald-100 bg-white p-5 shadow-[0_14px_42px_rgba(15,76,129,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-950">Aktivitas Terbaru</h2>
          <Link href="/dashboard/reward" className="text-xs font-semibold text-primary">
            Lihat semua
          </Link>
        </div>
        <ul className="mt-4 divide-y divide-blue-50">
          {activities.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
                <Coins className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{row.description}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {CREDIT_LEDGER_LABELS[row.source] || row.source} · {formatDate(row.createdAt)}
                </p>
              </div>
              <span className={cn("text-sm font-extrabold", row.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {row.amount >= 0 ? "+" : ""}
                {row.amount} kredit
              </span>
            </li>
          ))}
          {!activities.length && (
            <li className="py-4 text-sm text-slate-500">Belum ada aktivitas kredit.</li>
          )}
        </ul>
      </section>
    </aside>
  );
}

export function CommercialDashboard(props: CommercialDashboardProps) {
  return (
    <div className="hidden lg:-mt-5 lg:block">
      {/* ── Baris 1: Banner + Wallet (2-kolom) ── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardBannerBlock
          showBanners={props.showBanners}
          bannerSlides={props.bannerSlides}
          bannerAutoPlayMs={props.bannerAutoPlayMs}
        />
        <GuruWalletCard
          credits={props.credits}
          walletBalance={props.walletBalance}
          membershipPlan={props.membershipPlan}
        />
      </div>

      {/* ── Baris 2: Akses Cepat — full width ── */}
      <div className="mt-5">
        <QuickAccessGrid tools={props.tools} />
      </div>

      {/* ── Baris 3: Marketplace — full width, 1 baris produk acak ── */}
      <div className="mt-5">
        <MarketplaceSpotlightCard products={props.marketProducts} />
      </div>

      {/* ── Baris 4: Konten + Rail kanan (2-kolom) ── */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <AgendaCard agenda={props.agenda} />
            <ClassDocumentCard
              classes={props.classes}
              documents={props.documents}
              currentUserId={props.currentUserId}
            />
          </div>
          <Link
            href="/dashboard/reward"
            className="flex items-center justify-between rounded-[16px] border border-emerald-100 bg-emerald-50/80 px-5 py-3 text-sm shadow-sm transition-colors hover:bg-emerald-100/60"
          >
            <span className="inline-flex items-center gap-3 font-semibold text-primary">
              <Star className="h-4 w-4 fill-primary" />
              Tips Hari Ini
            </span>
            <span className="hidden text-slate-600 xl:block">Kerjakan misi harian untuk mendapatkan kredit gratis setiap hari.</span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-2 font-semibold text-primary">
              Lihat Misi Harian
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
        <RightRailBottom
          activities={props.activities}
          affiliateRank={props.affiliateRank}
          affiliateLeaderboard={props.affiliateLeaderboard}
        />
      </div>
    </div>
  );
}
