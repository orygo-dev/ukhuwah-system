"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import type { RewardConfig } from "@/lib/reward";
import type { RewardAdConfig } from "@/lib/reward-ad";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MissionRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  creditReward: number;
  missionType: string;
  maxPerDay: number;
  isActive: boolean;
};

async function readJsonResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Terjadi kesalahan. Silakan coba lagi.");
  }
  return data;
}

function toNonNegativeInt(value: number, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

export function AdminRewardClient() {
  const [config, setConfig] = useState<RewardConfig | null>(null);
  const [adConfig, setAdConfig] = useState<RewardAdConfig | null>(null);
  const [ssvUrl, setSsvUrl] = useState("");
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reward");
      const data = await readJsonResponse(res);
      setConfig(data.config);
      setAdConfig(data.adConfig);
      setSsvUrl(data.ssvCallbackUrl || "");
      setMissions(data.missions || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal memuat pengaturan reward");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config || !adConfig) return;
    if (!config.pageTitle.trim()) {
      setMessage("Judul halaman wajib diisi");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/reward", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          adConfig,
          missions: missions.map((m) => ({
            slug: m.slug,
            creditReward: toNonNegativeInt(m.creditReward),
            isActive: m.isActive,
            title: m.title.trim(),
            description: m.description.trim(),
          })),
        }),
      });
      const data = await readJsonResponse(res);
      setConfig(data.config);
      setAdConfig(data.adConfig);
      setMissions(data.missions);
      setMessage("Pengaturan reward tersimpan");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/reward">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/reward">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reward & Kredit</h1>
          <p className="mt-1 text-muted-foreground">
            Atur program misi kredit gratis untuk guru
          </p>
        </div>

        {message && (
          <div className="rounded-lg border bg-secondary p-3 text-sm">{message}</div>
        )}

        {config && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pengaturan Umum</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Program aktif</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig((c) => c && { ...c, enabled: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Judul halaman</Label>
                <Input
                  value={config.pageTitle}
                  onChange={(e) =>
                    setConfig((c) => c && { ...c, pageTitle: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={config.pageDescription}
                  onChange={(e) =>
                    setConfig((c) => c && { ...c, pageDescription: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Threshold kredit rendah (banner beranda)</Label>
                <Input
                  type="number"
                  min={0}
                  value={config.lowCreditThreshold}
                  onChange={(e) =>
                    setConfig((c) =>
                      c && { ...c, lowCreditThreshold: Number(e.target.value) }
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {adConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Iklan Reward (Fase 2)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Iklan reward aktif</Label>
                <Switch
                  checked={adConfig.enabled}
                  onCheckedChange={(v) =>
                    setAdConfig((c) => c && { ...c, enabled: v })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={adConfig.provider}
                  onValueChange={(v: RewardAdConfig["provider"]) =>
                    setAdConfig((c) => c && { ...c, provider: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (demo web)</SelectItem>
                    <SelectItem value="admob">AdMob + SSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kredit per iklan</Label>
                  <Input
                    type="number"
                    min={0}
                    value={adConfig.creditsPerAd}
                    onChange={(e) =>
                      setAdConfig((c) =>
                        c && { ...c, creditsPerAd: Number(e.target.value) }
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max iklan / hari</Label>
                  <Input
                    type="number"
                    min={1}
                    value={adConfig.maxAdsPerDay}
                    onChange={(e) =>
                      setAdConfig((c) =>
                        c && { ...c, maxAdsPerDay: Number(e.target.value) }
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min. detik tonton (sandbox)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={adConfig.minWatchSeconds}
                    onChange={(e) =>
                      setAdConfig((c) =>
                        c && { ...c, minWatchSeconds: Number(e.target.value) }
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cooldown antar iklan (detik)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={adConfig.cooldownSeconds}
                    onChange={(e) =>
                      setAdConfig((c) =>
                        c && { ...c, cooldownSeconds: Number(e.target.value) }
                      )
                    }
                  />
                </div>
              </div>
              {adConfig.provider === "admob" && (
                <>
                  <div className="space-y-2">
                    <Label>AdMob App ID</Label>
                    <Input
                      value={adConfig.admobAppId}
                      onChange={(e) =>
                        setAdConfig((c) => c && { ...c, admobAppId: e.target.value })
                      }
                      placeholder="ca-app-pub-..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>AdMob Ad Unit ID (Rewarded)</Label>
                    <Input
                      value={adConfig.admobAdUnitId}
                      onChange={(e) =>
                        setAdConfig((c) =>
                          c && { ...c, admobAdUnitId: e.target.value }
                        )
                      }
                      placeholder="ca-app-pub-.../..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SSV Callback URL (pasang di AdMob)</Label>
                    <Input readOnly value={ssvUrl} className="font-mono text-xs" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daftar Misi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {missions.map((m, idx) => (
              <div key={m.slug} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{m.title}</p>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {m.slug}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {m.missionType}
                    </Badge>
                  </div>
                  <Switch
                    checked={m.isActive}
                    onCheckedChange={(v) =>
                      setMissions((list) =>
                        list.map((row, i) =>
                          i === idx ? { ...row, isActive: v } : row
                        )
                      )
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Reward (kredit)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={m.creditReward}
                      onChange={(e) =>
                        setMissions((list) =>
                          list.map((row, i) =>
                            i === idx
                              ? { ...row, creditReward: Number(e.target.value) }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Deskripsi</Label>
                    <Input
                      value={m.description}
                      onChange={(e) =>
                        setMissions((list) =>
                          list.map((row, i) =>
                            i === idx ? { ...row, description: e.target.value } : row
                          )
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Simpan
        </Button>
      </div>
    </AdminShell>
  );
}
