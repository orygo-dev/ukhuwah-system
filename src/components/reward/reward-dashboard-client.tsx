"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  CircleDashed,
  Coins,
  Gift,
  Loader2,
  Lock,
  Sparkles,
  User,
  Video,
  Handshake,
  LogIn,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RewardConfig } from "@/lib/reward";
import type { MissionStatus, MissionView } from "@/lib/reward-missions";
import { AdWatchModal } from "@/components/reward/ad-watch-modal";

type LedgerRow = {
  id: string;
  amount: number;
  balanceAfter: number;
  source: string;
  sourceLabel: string;
  description: string;
  createdAt: string;
};

type AdInfo = {
  enabled: boolean;
  provider: string;
  creditsPerAd: number;
  maxAdsPerDay: number;
  minWatchSeconds: number;
  adsWatchedToday: number;
  cooldownRemaining: number;
  canWatch: boolean;
};

type RewardData = {
  config: RewardConfig;
  creditsRemaining: number;
  missions: MissionView[];
  ad: AdInfo;
  ledger: LedgerRow[];
};

const MISSION_ICONS: Record<string, typeof Gift> = {
  gift: Gift,
  user: User,
  sparkles: Sparkles,
  login: LogIn,
  handshake: Handshake,
  video: Video,
};

const STATUS_BADGE: Record<
  MissionStatus,
  { variant: "success" | "warning" | "secondary" | "default"; label?: string }
> = {
  ready: { variant: "success" },
  locked: { variant: "warning" },
  claimed: { variant: "secondary" },
  claimed_today: { variant: "secondary" },
  disabled: { variant: "secondary" },
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function readJsonResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Terjadi kesalahan. Silakan coba lagi.");
  }
  return data;
}

export function RewardDashboardClient() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"missions" | "history">("missions");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/reward/me");
    const json = await readJsonResponse(res);
    setData(json);
  }, []);

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (searchParams.get("tab") === "history") {
      setTab("history");
    }
  }, [searchParams]);

  const claimMission = async (slug: string) => {
    if (claiming) return;
    setClaiming(slug);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/reward/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionSlug: slug }),
      });
      const json = await readJsonResponse(res);
      setMessage(json.message);
      await load();
      await update();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal klaim");
    } finally {
      setClaiming(null);
    }
  };

  const closeAdModal = useCallback(() => {
    setAdModalOpen(false);
  }, []);

  const handleAdSuccess = useCallback(
    async (msg: string) => {
      setMessage(msg);
      await load();
      await update();
      router.refresh();
    },
    [load, router, update]
  );

  const handleAdError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/reward">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!data?.config.enabled) {
    return (
      <DashboardShell activePath="/dashboard/reward">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Program reward sedang tidak aktif. Hubungi admin.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activePath="/dashboard/reward"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: data.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="h-7 w-7 text-primary" />
            {data.config.pageTitle}
          </h1>
          <p className="mt-1 text-muted-foreground">{data.config.pageDescription}</p>
          <p className="mt-2 text-sm">
            Saldo kredit:{" "}
            <span className="font-semibold text-primary">{data.creditsRemaining}</span>
          </p>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex gap-2 border-b">
          {(
            [
              { id: "missions" as const, label: "Misi" },
              { id: "history" as const, label: "Riwayat" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "missions" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.missions.map((mission) => {
              const Icon = MISSION_ICONS[mission.icon] || Gift;
              const badge = STATUS_BADGE[mission.status];
              const isWatchAd = mission.slug === "watch-ad";
              const canClaim = mission.status === "ready" && !isWatchAd;
              const canWatchAd =
                isWatchAd &&
                mission.status === "ready" &&
                data.ad.enabled &&
                data.ad.canWatch;

              return (
                <Card
                  key={mission.id}
                  className={cn(
                    canClaim && "border-primary/30 shadow-sm",
                    mission.status === "disabled" && "opacity-70"
                  )}
                >
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold leading-tight">{mission.title}</p>
                        <Badge variant={badge.variant} className="shrink-0 text-[10px]">
                          {mission.statusLabel}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{mission.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Coins className="h-3 w-3" />+{mission.creditReward} kredit
                        </Badge>
                        {mission.missionType === "DAILY" && (
                          <span className="text-xs text-muted-foreground">
                            {mission.claimsToday}/{mission.maxPerDay} hari ini
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {canWatchAd ? (
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={Boolean(claiming)}
                            onClick={() => {
                              setError("");
                              setAdModalOpen(true);
                            }}
                          >
                            <Video className="mr-1 h-4 w-4" />
                            Tonton Iklan
                          </Button>
                        ) : canClaim ? (
                          <Button
                            size="sm"
                            variant="brand"
                            disabled={Boolean(claiming)}
                            onClick={() => claimMission(mission.slug)}
                          >
                            {claiming === mission.slug ? (
                              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                            )}
                            Klaim
                          </Button>
                        ) : mission.status === "locked" && mission.actionUrl ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={mission.actionUrl}>
                              <Lock className="mr-1 h-4 w-4" />
                              Kerjakan
                            </Link>
                          </Button>
                        ) : mission.status === "claimed" || mission.status === "claimed_today" ? (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                            Selesai
                          </span>
                        ) : mission.status === "disabled" ? (
                          <span className="inline-flex items-center text-xs text-muted-foreground">
                            <CircleDashed className="mr-1 h-3.5 w-3.5" />
                            Segera hadir
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Kredit</CardTitle>
            </CardHeader>
            <CardContent>
              {data.ledger.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada riwayat. Selesaikan misi untuk mendapatkan kredit!
                </p>
              ) : (
                <ul className="divide-y">
                  {data.ledger.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{row.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.sourceLabel} · {formatDateTime(row.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "font-semibold tabular-nums",
                            row.amount > 0 ? "text-emerald-600" : "text-destructive"
                          )}
                        >
                          {row.amount > 0 ? "+" : ""}
                          {row.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          sisa {row.balanceAfter}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AdWatchModal
        open={adModalOpen}
        onClose={closeAdModal}
        onSuccess={handleAdSuccess}
        onError={handleAdError}
      />
    </DashboardShell>
  );
}
