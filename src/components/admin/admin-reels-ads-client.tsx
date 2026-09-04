"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReelsAd,
  isGoogleAdmobAdUnitId,
  isGoogleAdmobAppId,
  isGoogleAdmobConfigurationReady,
  isGoogleAdmobReady,
  isGoogleAdsenseReady,
  type ReelsAd,
  type ReelsAdsConfig,
} from "@/lib/reels-ads.shared";
import { apiError, readResponseJson } from "@/lib/http-json";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type ValidationIssue = { path: string; message: string };

function cleanAdmobId(value: string) {
  return value.replace(/\s+/g, "");
}

function admobIdError(value: string) {
  if (!value || isGoogleAdmobAdUnitId(value)) return "";
  if (isGoogleAdmobAppId(value)) {
    return "Yang ditempel adalah App ID (tandanya memakai ~). Kolom ini membutuhkan Ad Unit ID yang memakai /.";
  }
  return "Format belum benar. Contoh: ca-app-pub-1234567890123456/1234567890";
}

const studentPlacementFields = [
  ["studentMadingNativeAdUnitId", "Native Mading Preview", "Native"],
  ["studentReadingBannerAdUnitId", "Banner Zona Baca", "Banner"],
  ["studentMadingBannerAdUnitId", "Banner daftar Mading", "Banner"],
  ["studentAssignmentsBannerAdUnitId", "Banner daftar Tugas", "Banner"],
  ["studentQuizBannerAdUnitId", "Banner daftar Quiz", "Banner"],
] as const;

function issueMap(issues: ValidationIssue[] | undefined) {
  return Object.fromEntries((issues ?? []).map((issue) => [issue.path, issue.message]));
}

function AdEditor({
  ad,
  onChange,
  onRemove,
}: {
  ad: ReelsAd;
  onChange: (ad: ReelsAd) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {ad.title || `Iklan #${ad.sortOrder + 1}`}
        </p>
        <div className="flex items-center gap-2">
          <Switch
            checked={ad.isActive}
            onCheckedChange={(v) => onChange({ ...ad, isActive: v })}
            aria-label="Aktifkan iklan"
          />
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipe media">
          <Select
            value={ad.type}
            onValueChange={(v: "image" | "video") =>
              onChange({
                ...ad,
                type: v,
                mediaUrl: v === ad.type ? ad.mediaUrl : "",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Gambar</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Urutan">
          <Input
            type="number"
            min={0}
            value={ad.sortOrder}
            onChange={(e) =>
              onChange({ ...ad, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Label CTA">
          <Input
            value={ad.ctaLabel}
            onChange={(e) => onChange({ ...ad, ctaLabel: e.target.value })}
            placeholder="Pelajari"
          />
        </Field>
      </div>

      {ad.type === "image" ? (
        <ImageUploadField
          label="Gambar iklan"
          hint="Disarankan rasio vertikal 9:16. JPG/PNG/WebP/GIF maks. 5 MB."
          value={ad.mediaUrl}
          kind="reels-ad"
          onChange={(url) => onChange({ ...ad, mediaUrl: url })}
          previewClassName="max-h-64 w-full object-contain"
        />
      ) : (
        <>
          <Field label="URL video" hint="URL langsung file .mp4 / .webm">
            <Input
              value={ad.mediaUrl}
              onChange={(e) => onChange({ ...ad, mediaUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          {ad.mediaUrl ? (
            <div className="overflow-hidden rounded-lg border bg-muted/30">
              <video
                src={toSameOriginUploadUrl(ad.mediaUrl)}
                className="max-h-56 w-full object-contain"
                muted
                playsInline
                controls
              />
            </div>
          ) : null}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Judul">
          <Input
            value={ad.title}
            onChange={(e) => onChange({ ...ad, title: e.target.value })}
            placeholder="Judul promo"
          />
        </Field>
        <Field label="Link saat diklik">
          <Input
            value={ad.linkUrl}
            onChange={(e) => onChange({ ...ad, linkUrl: e.target.value })}
            placeholder="/dashboard/billing atau https://..."
          />
        </Field>
      </div>
      <Field label="Caption">
        <Input
          value={ad.caption}
          onChange={(e) => onChange({ ...ad, caption: e.target.value })}
          placeholder="Teks singkat di reel"
        />
      </Field>
      <p className="text-xs text-slate-500">
        Impression {ad.impressionCount.toLocaleString("id-ID")} · Klik{" "}
        {ad.clickCount.toLocaleString("id-ID")}
      </p>
    </div>
  );
}

export function AdminReelsAdsClient() {
  const [config, setConfig] = useState<ReelsAdsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAdmob, setSavingAdmob] = useState(false);
  const [message, setMessage] = useState("");
  const [admobMessage, setAdmobMessage] = useState("");
  const [admobIssues, setAdmobIssues] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/admin/reels-ads", { signal, cache: "no-store" });
      const data = await readResponseJson<{ config?: ReelsAdsConfig }>(
        res,
        "Gagal memuat pengaturan Reels Ads"
      );
      if (!res.ok || !data.config) {
        throw new Error(apiError(data, "Gagal memuat pengaturan Reels Ads"));
      }
      setConfig(data.config);
    } catch (cause) {
      if (signal?.aborted) return;
      setLoadError(
        cause instanceof Error ? cause.message : "Gagal memuat pengaturan Reels Ads"
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const patch = (updater: (c: ReelsAdsConfig) => ReelsAdsConfig) => {
    setConfig((prev) => (prev ? updater(prev) : prev));
    setMessage("");
    setAdmobMessage("");
    setAdmobIssues({});
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/reels-ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await readResponseJson<{ config?: ReelsAdsConfig }>(
        res,
        "Gagal menyimpan pengaturan"
      );
      if (!res.ok || !data.config) throw new Error(apiError(data, "Gagal menyimpan"));
      setConfig(data.config);
      setMessage("Reels Ads berhasil disimpan");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAdmob = async () => {
    if (!config || savingAdmob) return;
    const studentError = admobIdError(config.googleAdmob.studentAndroidAdUnitId);
    const teacherError = admobIdError(config.googleAdmob.teacherAndroidAdUnitId);
    const localIssues: Record<string, string> = {};
    if (studentError) localIssues.studentAndroidAdUnitId = studentError;
    if (teacherError) localIssues.teacherAndroidAdUnitId = teacherError;
    for (const [field] of studentPlacementFields) {
      const error = admobIdError(config.googleAdmob[field]);
      if (error) localIssues[field] = error;
    }
    if (
      config.googleAdmob.enabled &&
      ![
        config.googleAdmob.studentAndroidAdUnitId,
        config.googleAdmob.teacherAndroidAdUnitId,
        ...studentPlacementFields.map(([field]) => config.googleAdmob[field]),
      ].some(isGoogleAdmobAdUnitId)
    ) {
      localIssues.studentAndroidAdUnitId ||= "Isi minimal satu Ad Unit ID sebelum mengaktifkan AdMob.";
    }
    if (config.googleAdmob.enabled && !config.googleAdmob.policyConfirmed) {
      localIssues.policyConfirmed = "Konfirmasi kesiapan kebijakan sebelum mengaktifkan AdMob.";
    }
    if (Object.keys(localIssues).length > 0) {
      setAdmobIssues(localIssues);
      setAdmobMessage("Periksa kolom yang ditandai sebelum menyimpan.");
      return;
    }

    setSavingAdmob(true);
    setAdmobMessage("");
    setAdmobIssues({});
    try {
      const res = await fetch("/api/admin/reels-ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-admob",
          googleAdmob: config.googleAdmob,
        }),
      });
      const data = await readResponseJson<{
        config?: ReelsAdsConfig;
        issues?: ValidationIssue[];
      }>(res, "Gagal menyimpan AdMob");
      if (!res.ok || !data.config) {
        setAdmobIssues(issueMap(data.issues));
        throw new Error(apiError(data, "Gagal menyimpan AdMob"));
      }
      setConfig(data.config);
      setAdmobMessage(
        data.config.googleAdmob.enabled
          ? "AdMob Android berhasil disimpan dan diaktifkan."
          : "Pengaturan AdMob berhasil disimpan dalam keadaan nonaktif."
      );
    } catch (cause) {
      setAdmobMessage(cause instanceof Error ? cause.message : "Gagal menyimpan AdMob");
    } finally {
      setSavingAdmob(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/reels-ads">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  if (!config) {
    return (
      <AdminShell activePath="/admin/reels-ads">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="font-semibold">{loadError || "Pengaturan Reels Ads tidak tersedia."}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              void load();
            }}
          >
            Coba lagi
          </Button>
        </div>
      </AdminShell>
    );
  }

  const activeCount = config.ads.filter((ad) => ad.isActive && ad.mediaUrl.trim()).length;
  const googleReady = isGoogleAdsenseReady(config.googleAdsense);
  const admobConfigured = isGoogleAdmobConfigurationReady(config.googleAdmob);
  const admobReady = isGoogleAdmobReady(config.googleAdmob);
  const studentAdmobError =
    admobIssues["googleAdmob.studentAndroidAdUnitId"] ||
    admobIssues.studentAndroidAdUnitId ||
    admobIdError(config.googleAdmob.studentAndroidAdUnitId);
  const teacherAdmobError =
    admobIssues["googleAdmob.teacherAndroidAdUnitId"] ||
    admobIssues.teacherAndroidAdUnitId ||
    admobIdError(config.googleAdmob.teacherAndroidAdUnitId);
  const policyAdmobError =
    admobIssues["googleAdmob.policyConfirmed"] || admobIssues.policyConfirmed;
  const placementError = (field: (typeof studentPlacementFields)[number][0]) =>
    admobIssues[`googleAdmob.${field}`] ||
    admobIssues[field] ||
    admobIdError(config.googleAdmob[field]);

  return (
    <AdminShell activePath="/admin/reels-ads">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Megaphone className="h-7 w-7" />
              Reels Ads
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola iklan sela Zona Kreasi web dan AdMob Native Android secara terpisah.
              Mengubah salah satunya tidak mengubah penayangan lainnya.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <a href="/dashboard/spotlight" target="_blank" rel="noreferrer">
                <Eye className="mr-1 h-4 w-4" />
                Buka Zona Kreasi
              </a>
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Simpan pengaturan web
            </Button>
          </div>
        </div>

        {message ? (
          <p
            className={
              message.includes("berhasil")
                ? "text-sm text-emerald-600"
                : "text-sm text-destructive"
            }
          >
            {message}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan penayangan web</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Aktifkan Reels Ads</p>
                <p className="text-xs text-muted-foreground">
                  {config.provider === "google-adsense"
                    ? googleReady
                      ? "Unit Google siap dikirim ke feed"
                      : "Lengkapi konfigurasi Google terlebih dahulu"
                    : `${activeCount} iklan platform siap tayang`}
                </p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) => patch((c) => ({ ...c, enabled: v }))}
                aria-label="Aktifkan reels ads"
              />
            </div>
            <Field
              label="Sumber iklan"
              hint="Data iklan platform tetap tersimpan saat Anda berpindah provider."
            >
              <Select
                value={config.provider}
                onValueChange={(provider: "platform" | "google-adsense") =>
                  patch((current) => ({ ...current, provider, enabled: false }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">Iklan milik platform</SelectItem>
                  <SelectItem value="google-adsense">Google AdSense (web)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Frekuensi sisipan"
              hint="1 iklan setelah setiap N konten Zona Kreasi organik (3–20)."
            >
              <Input
                type="number"
                min={3}
                max={20}
                value={config.everyNPosts}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    everyNPosts: Number(e.target.value) || 6,
                  }))
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              AdMob Android — pengaturan sederhana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="flex gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Gunakan Ad Unit ID sesuai format iklannya</p>
                  <p className="mt-1 text-xs leading-5">
                    Buat unit Native untuk feed dan unit Banner untuk halaman daftar. Semua ID yang
                    benar memakai tanda <strong>/</strong>. App ID yang memakai <strong>~</strong>
                    tidak diisi di halaman ini karena sudah dipasang saat build Android.
                  </p>
                </div>
              </div>
            </div>

            <details className="rounded-xl border px-4 py-3" open>
              <summary className="cursor-pointer text-sm font-semibold">
                Penempatan tambahan aplikasi siswa
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {studentPlacementFields.map(([field, label, format]) => {
                  const error = placementError(field);
                  return (
                    <div key={field} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor={field}>{label}</Label>
                        {isGoogleAdmobAdUnitId(config.googleAdmob[field]) ? (
                          <span className="text-xs font-semibold text-emerald-600">Format benar</span>
                        ) : null}
                      </div>
                      <Input
                        id={field}
                        value={config.googleAdmob[field]}
                        onChange={(event) =>
                          patch((current) => ({
                            ...current,
                            googleAdmob: {
                              ...current.googleAdmob,
                              [field]: cleanAdmobId(event.target.value),
                            },
                          }))
                        }
                        placeholder="ca-app-pub-1234567890123456/1234567890"
                        autoComplete="off"
                        aria-invalid={Boolean(error)}
                      />
                      <p className={error ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                        {error || `Buat sebagai format ${format} di AdMob.`}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 max-w-sm">
                <Field
                  label="Frekuensi Native Mading"
                  hint="Satu iklan setelah 4–20 preview organik; rekomendasi 5."
                >
                  <Select
                    value={String(config.googleAdmob.madingEveryNPosts)}
                    onValueChange={(value) =>
                      patch((current) => ({
                        ...current,
                        googleAdmob: {
                          ...current.googleAdmob,
                          madingEveryNPosts: Number(value),
                        },
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 17 }, (_, index) => index + 4).map((frequency) => (
                        <SelectItem key={frequency} value={String(frequency)}>
                          Setiap {frequency} konten{frequency === 5 ? " (disarankan)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </details>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="student-admob-unit">1. Native Ad Unit ID aplikasi siswa</Label>
                {isGoogleAdmobAdUnitId(config.googleAdmob.studentAndroidAdUnitId) ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Format benar
                  </span>
                ) : null}
              </div>
              <Input
                id="student-admob-unit"
                value={config.googleAdmob.studentAndroidAdUnitId}
                onChange={(event) =>
                  patch((current) => ({
                    ...current,
                    googleAdmob: {
                      ...current.googleAdmob,
                      studentAndroidAdUnitId: cleanAdmobId(event.target.value),
                    },
                  }))
                }
                placeholder="ca-app-pub-1234567890123456/1234567890"
                autoComplete="off"
                aria-invalid={Boolean(studentAdmobError)}
              />
              {studentAdmobError ? (
                <p className="text-xs font-medium text-destructive">{studentAdmobError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Digunakan oleh package <strong>com.genpro.app</strong>.
                </p>
              )}
            </div>

            <details className="rounded-xl border px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Aplikasi guru (opsional)
              </summary>
              <div className="mt-4 space-y-2">
                <Label htmlFor="teacher-admob-unit">Native Ad Unit ID aplikasi guru</Label>
                <Input
                  id="teacher-admob-unit"
                  value={config.googleAdmob.teacherAndroidAdUnitId}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      googleAdmob: {
                        ...current.googleAdmob,
                        teacherAndroidAdUnitId: cleanAdmobId(event.target.value),
                      },
                    }))
                  }
                  placeholder="ca-app-pub-1234567890123456/1234567890"
                  autoComplete="off"
                  aria-invalid={Boolean(teacherAdmobError)}
                />
                {teacherAdmobError ? (
                  <p className="text-xs font-medium text-destructive">{teacherAdmobError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Biarkan kosong jika aplikasi guru belum memakai iklan.
                  </p>
                )}
              </div>
            </details>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="2. Frekuensi iklan"
                hint="Rekomendasi: satu iklan setiap 6 konten."
              >
                <Select
                  value={String(config.googleAdmob.everyNPosts)}
                  onValueChange={(value) =>
                    patch((current) => ({
                      ...current,
                      googleAdmob: {
                        ...current.googleAdmob,
                        everyNPosts: Number(value),
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, index) => index + 3).map(
                      (frequency) => (
                        <SelectItem key={frequency} value={String(frequency)}>
                          Setiap {frequency} konten
                          {frequency === 6 ? " (disarankan)" : ""}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">3. Konfirmasi kesiapan</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Saya sudah membuat pesan privasi UMP di AdMob, memoderasi konten, menyediakan
                  kebijakan privasi, serta membuat unit Native/Banner sesuai penempatannya.
                </p>
                {policyAdmobError ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{policyAdmobError}</p>
                ) : null}
              </div>
              <Switch
                checked={config.googleAdmob.policyConfirmed}
                onCheckedChange={(policyConfirmed) =>
                  patch((current) => ({
                    ...current,
                    googleAdmob: { ...current.googleAdmob, policyConfirmed },
                  }))
                }
                aria-label="Konfirmasi kesiapan kebijakan Google AdMob"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Aktifkan AdMob Android</p>
                <p className="text-xs text-muted-foreground">
                  {admobReady
                    ? "Aktif dan siap dikirim ke aplikasi Android."
                    : admobConfigured
                      ? "Konfigurasi lengkap. Aktifkan lalu simpan."
                      : "Selesaikan langkah 1–3 terlebih dahulu."}
                </p>
              </div>
              <Switch
                checked={config.googleAdmob.enabled}
                disabled={!admobConfigured && !config.googleAdmob.enabled}
                onCheckedChange={(enabled) =>
                  patch((current) => ({
                    ...current,
                    googleAdmob: { ...current.googleAdmob, enabled },
                  }))
                }
                aria-label="Aktifkan AdMob Android"
              />
            </div>

            {admobMessage ? (
              <p
                className={
                  admobMessage.includes("berhasil")
                    ? "text-sm font-medium text-emerald-600"
                    : "text-sm font-medium text-destructive"
                }
              >
                {admobMessage}
              </p>
            ) : null}

            <Button
              type="button"
              onClick={handleSaveAdmob}
              disabled={savingAdmob}
              className="w-full sm:w-auto"
            >
              {savingAdmob ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan pengaturan AdMob
            </Button>
          </CardContent>
        </Card>

        {config.provider === "google-adsense" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Google AdSense</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p className="font-semibold">Perlindungan remaja selalu aktif (TFAT=2)</p>
                <p className="mt-1 text-xs leading-5">
                  Personalisasi dan remarketing dinonaktifkan untuk unit ini. Navalogi tidak
                  membuat pelacakan klik/impression tambahan untuk iklan Google.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Publisher ID" hint="Contoh: ca-pub-1234567890123456">
                  <Input
                    value={config.googleAdsense.publisherId}
                    onChange={(event) =>
                      patch((current) => ({
                        ...current,
                        googleAdsense: {
                          ...current.googleAdsense,
                          publisherId: event.target.value,
                        },
                      }))
                    }
                    placeholder="ca-pub-0000000000000000"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Display Ad Slot ID" hint="ID numerik dari unit Display responsif.">
                  <Input
                    value={config.googleAdsense.slotId}
                    onChange={(event) =>
                      patch((current) => ({
                        ...current,
                        googleAdsense: {
                          ...current.googleAdsense,
                          slotId: event.target.value,
                        },
                      }))
                    }
                    placeholder="1234567890"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </Field>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Konfirmasi kesiapan kebijakan</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Site telah disetujui AdSense, crawler login telah disiapkan, konten
                    Zona Kreasi dimoderasi, kebijakan privasi diperbarui, dan Privacy &amp;
                    Messaging/CMP Google telah dikonfigurasi untuk wilayah yang diwajibkan.
                  </p>
                </div>
                <Switch
                  checked={config.googleAdsense.policyConfirmed}
                  onCheckedChange={(policyConfirmed) =>
                    patch((current) => ({
                      ...current,
                      googleAdsense: {
                        ...current.googleAdsense,
                        policyConfirmed,
                      },
                    }))
                  }
                  aria-label="Konfirmasi kesiapan kebijakan Google AdSense"
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                AdSense hanya akan dimuat pada Zona Kreasi guru web setelah konfigurasi valid dan
                Reels Ads diaktifkan. Ketersediaan serta pendapatan tetap ditentukan Google.
              </p>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Daftar iklan</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Media vertikal, judul, caption, dan CTA opsional.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                patch((c) => ({
                  ...c,
                  ads: [
                    ...c.ads,
                    createReelsAd({ sortOrder: c.ads.length }),
                  ],
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Tambah Iklan
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.ads.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada iklan. Tambahkan gambar/video vertikal untuk mulai tayang di Zona Kreasi.
              </p>
            ) : (
              config.ads.map((ad, index) => (
                <AdEditor
                  key={ad.id}
                  ad={ad}
                  onChange={(next) =>
                    patch((c) => {
                      const ads = [...c.ads];
                      ads[index] = next;
                      return { ...c, ads };
                    })
                  }
                  onRemove={() =>
                    patch((c) => ({
                      ...c,
                      ads: c.ads.filter((_, i) => i !== index),
                    }))
                  }
                />
              ))
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </AdminShell>
  );
}
