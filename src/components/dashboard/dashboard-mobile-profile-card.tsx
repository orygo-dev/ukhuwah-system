import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Coins,
  Crown,
  GraduationCap,
  History,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardMobileProfileCardProps = {
  name: string;
  avatarUrl?: string | null;
  schoolName: string;
  classNames: string[];
  credits: number;
  membershipPlan?: {
    name: string;
    slug: string;
    expiresAt?: string | null;
  } | null;
};

function initialsFromName(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardMobileProfileCard({
  name,
  avatarUrl,
  schoolName,
  classNames,
  credits,
  membershipPlan,
}: DashboardMobileProfileCardProps) {
  const initials = initialsFromName(name);
  const classLabel =
    classNames.length === 0
      ? null
      : classNames.length <= 2
        ? classNames.join(", ")
        : `${classNames.slice(0, 2).join(", ")} +${classNames.length - 2}`;

  const metaLine = [schoolName, classLabel ? `Kelas ${classLabel}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-md shadow-brand-900/10 lg:hidden">
      <div className="absolute inset-0 gradient-brand-card" />
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 100% 0%, rgba(147, 197, 253, 0.45) 0%, transparent 52%), radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.2) 0%, transparent 45%)",
        }}
      />

      <div className="relative px-4 py-3.5 text-white">
        {/* Baris profil */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/profil" className="relative shrink-0">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-14 w-14 rounded-xl object-cover ring-2 ring-white/30"
              />
            ) : (
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl",
                  "bg-white/20 text-base font-bold ring-2 ring-white/30"
                )}
              >
                {initials}
              </div>
            )}
            {membershipPlan ? (
              <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-emerald-600 text-white">
                <Crown className="h-3 w-3" />
              </span>
            ) : null}
          </Link>

          <div className="min-w-0 flex-1">
            <Link href="/dashboard/profil" className="block min-w-0">
              <h2 className="truncate text-base font-bold leading-tight">{name}</h2>
            </Link>
            {metaLine ? (
              <p className="mt-0.5 truncate text-xs text-white/85">{metaLine}</p>
            ) : (
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                <Link
                  href="/dashboard/profil?required=1"
                  className="inline-flex items-center gap-1 text-white/80 underline underline-offset-2"
                >
                  <Building2 className="h-3 w-3" />
                  Sekolah
                </Link>
                <Link
                  href="/dashboard/kelas"
                  className="inline-flex items-center gap-1 text-white/80"
                >
                  <GraduationCap className="h-3 w-3" />
                  Kelas
                </Link>
              </div>
            )}
            {membershipPlan ? (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white ring-1 ring-white/20">
                <Crown className="h-3 w-3" />
                {membershipPlan.name}
              </span>
            ) : null}
          </div>

          <Link
            href="/dashboard/profil"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15"
            aria-label="Profil"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Baris kredit — satu strip horizontal */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-200/20 bg-sky-950/10 px-3 py-2.5 backdrop-blur-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-300/25 ring-1 ring-white/20">
              <Coins className="h-4 w-4 text-sky-100" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/65">
                Kredit
              </p>
              <p className="text-xl font-bold leading-none tabular-nums">{credits}</p>
            </div>
          </div>

          <div className="flex shrink-0 gap-1.5">
            <Button
              size="sm"
              className="h-8 px-2.5 bg-white text-xs font-semibold text-primary hover:bg-white/95"
              asChild
            >
              <Link href="/dashboard/topup">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Top Up
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 border-white/30 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 hover:text-white"
              asChild
            >
              <Link href="/dashboard/reward?tab=history">
                <History className="mr-1 h-3.5 w-3.5" />
                Riwayat
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
