"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { DashboardPopupAd } from "@/components/dashboard/dashboard-popup-ad";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  Grid2X2,
  Loader2,
  MonitorPlay,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  activeSlides,
  createMediaSlide,
  type AppDisplayConfig,
  type MediaSlide,
} from "@/lib/app-display.shared";
import type { UploadKind } from "@/lib/media-upload";
import { invalidateAppDisplayCache } from "@/hooks/use-app-display";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

const QUICK_MENU_FIELDS = [
  ["attendance", "Absensi"],
  ["assignments", "Tugas"],
  ["quiz", "Quiz"],
  ["pjj", "PJJ"],
  ["tka", "TKA"],
  ["reading", "Zona Baca"],
  ["creations", "Zona Kreasi"],
  ["board", "Mading"],
] as const;

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
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SlideEditor({
  slide,
  uploadKind,
  onChange,
  onRemove,
}: {
  slide: MediaSlide;
  uploadKind: UploadKind;
  onChange: (s: MediaSlide) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {slide.title || `Slide #${slide.sortOrder + 1}`}
        </p>
        <div className="flex items-center gap-2">
          <Switch
            checked={slide.isActive}
            onCheckedChange={(v) => onChange({ ...slide, isActive: v })}
          />
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipe media">
          <Select
            value={slide.type}
            onValueChange={(v: "image" | "video") =>
              onChange({ ...slide, type: v, mediaUrl: v === slide.type ? slide.mediaUrl : "" })
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
            value={slide.sortOrder}
            onChange={(e) =>
              onChange({ ...slide, sortOrder: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </div>

      {slide.type === "image" ? (
        <ImageUploadField
          label="Gambar slide"
          hint="Unggah dari perangkat Anda. Format: JPG, PNG, WebP, GIF (maks. 5 MB)."
          value={slide.mediaUrl}
          kind={uploadKind}
          onChange={(url) => onChange({ ...slide, mediaUrl: url })}
        />
      ) : (
        <>
          <Field
            label="URL video"
            hint="URL langsung ke file video (.mp4, .webm)"
          >
            <Input
              value={slide.mediaUrl}
              onChange={(e) => onChange({ ...slide, mediaUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          {slide.mediaUrl && (
            <div className="overflow-hidden rounded-lg border bg-muted/30">
              <video
                src={slide.mediaUrl}
                className="max-h-32 w-full object-contain"
                muted
                playsInline
                controls
              />
            </div>
          )}
        </>
      )}

      <Field label="Judul (opsional)">
        <Input
          value={slide.title || ""}
          onChange={(e) => onChange({ ...slide, title: e.target.value })}
        />
      </Field>
      <Field label="Link saat diklik (opsional)">
        <Input
          value={slide.linkUrl || ""}
          onChange={(e) => onChange({ ...slide, linkUrl: e.target.value })}
          placeholder="/dashboard/reward atau https://..."
        />
      </Field>
    </div>
  );
}

export function AdminAppDisplayClient() {
  const [config, setConfig] = useState<AppDisplayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [popupPreviewOpen, setPopupPreviewOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/app-display");
    const data = await res.json();
    if (res.ok) setConfig(data.config);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (updater: (c: AppDisplayConfig) => AppDisplayConfig) => {
    setConfig((prev) => (prev ? updater(prev) : prev));
    setMessage("");
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/app-display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setConfig(data.config);
      invalidateAppDisplayCache();
      setMessage("Pengaturan tampilan berhasil disimpan");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Kembalikan semua pengaturan tampilan ke default?")) return;
    setResetting(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/app-display", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal reset");
      setConfig(data.config);
      invalidateAppDisplayCache();
      setMessage("Dikembalikan ke default");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal reset");
    } finally {
      setResetting(false);
    }
  };

  const updateBannerSlide = (i: number, slide: MediaSlide) => {
    patch((c) => {
      const slides = [...c.banners.slides];
      slides[i] = slide;
      const hasDisplayable = slides.some((s) => s.isActive && s.mediaUrl.trim());
      return {
        ...c,
        banners: {
          ...c.banners,
          enabled: hasDisplayable ? true : c.banners.enabled,
          slides,
        },
      };
    });
  };

  const updateDesktopBannerSlide = (i: number, slide: MediaSlide) => {
    patch((c) => {
      const slides = [...c.desktopBanners.slides];
      slides[i] = slide;
      const hasDisplayable = slides.some((s) => s.isActive && s.mediaUrl.trim());
      return {
        ...c,
        desktopBanners: {
          ...c.desktopBanners,
          enabled: hasDisplayable ? true : c.desktopBanners.enabled,
          slides,
        },
      };
    });
  };

  const updatePopupSlide = (i: number, slide: MediaSlide) => {
    patch((c) => {
      const slides = [...c.popup.slides];
      slides[i] = slide;
      const hasDisplayable = slides.some((item) => item.isActive && item.mediaUrl.trim());
      return {
        ...c,
        popup: {
          ...c.popup,
          enabled: hasDisplayable ? true : c.popup.enabled,
          slides,
        },
      };
    });
  };

  if (loading || !config) {
    return (
      <AdminShell activePath="/admin/app-display">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/app-display">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <MonitorPlay className="h-7 w-7" />
              Tampilan & Promo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Logo aplikasi, ikon Menu Cepat siswa, banner dashboard, dan popup promo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={resetting || saving}
            >
              {resetting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-4 w-4" />
              )}
              Reset
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Simpan
            </Button>
          </div>
        </div>

        {message && (
          <p
            className={
              message.includes("berhasil") || message.includes("default")
                ? "text-sm text-emerald-600"
                : "text-sm text-destructive"
            }
          >
            {message}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logo & Nama Aplikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Nama aplikasi" hint="Tampil di login, sidebar, dan header mobile">
              <Input
                value={config.branding.appName}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    branding: { ...c.branding, appName: e.target.value },
                  }))
                }
              />
            </Field>
            <ImageUploadField
              label="Logo aplikasi"
              hint="Unggah logo tanpa frame/background. Kosongkan untuk menampilkan inisial teks."
              value={config.branding.logoUrl}
              kind="logo"
              previewClassName="h-12 w-auto max-w-[200px] object-contain"
              onChange={(url) =>
                patch((c) => ({
                  ...c,
                  branding: { ...c.branding, logoUrl: url },
                }))
              }
            />
            <ImageUploadField
              label="Logo login & registrasi"
              hint="Logo khusus untuk halaman login dan registrasi. Jika kosong, halaman auth memakai logo aplikasi."
              value={config.branding.authLogoUrl}
              kind="auth-logo"
              previewClassName="h-14 w-auto max-w-[200px] object-contain"
              onChange={(url) =>
                patch((c) => ({
                  ...c,
                  branding: { ...c.branding, authLogoUrl: url },
                }))
              }
            />
            {config.branding.logoUrl && (
              <p className="text-xs text-muted-foreground">
                Nama aplikasi tetap dipakai untuk metadata, alt text, dan footer:{" "}
                <span className="font-semibold text-foreground">
                  {config.branding.appName}
                </span>
              </p>
            )}
            <Field label="Tagline halaman login">
              <Textarea
                rows={2}
                value={config.branding.loginTagline}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    branding: { ...c.branding, loginTagline: e.target.value },
                  }))
                }
              />
            </Field>
            <Field label="Subteks login (info demo, dll.)">
              <Textarea
                rows={3}
                value={config.branding.loginSubtitle}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    branding: { ...c.branding, loginSubtitle: e.target.value },
                  }))
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid2X2 className="h-4 w-4" />
                Ikon Menu Cepat Siswa
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Gunakan gambar persegi. Jika dikosongkan atau gagal dimuat,
                aplikasi otomatis memakai ikon bawaan yang tersimpan di APK.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                patch((c) => ({
                  ...c,
                  quickMenuIcons: {
                    ...c.quickMenuIcons,
                    icons: Object.fromEntries(
                      QUICK_MENU_FIELDS.map(([key]) => [key, ""])
                    ) as AppDisplayConfig["quickMenuIcons"]["icons"],
                  },
                }))
              }
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Gunakan Bawaan
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_MENU_FIELDS.map(([key, label]) => (
                <ImageUploadField
                  key={key}
                  label={label}
                  hint="PNG/WebP persegi, maks. 5 MB."
                  value={config.quickMenuIcons.icons[key]}
                  kind="quick-menu-icon"
                  requireSquare
                  previewClassName="mx-auto h-20 w-20 rounded-2xl object-cover"
                  onChange={(url) =>
                    patch((c) => ({
                      ...c,
                      quickMenuIcons: {
                        ...c.quickMenuIcons,
                        icons: {
                          ...c.quickMenuIcons.icons,
                          [key]: url,
                        },
                      },
                    }))
                  }
                />
              ))}
            </div>
            <p className="mt-5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Klik <strong>Simpan</strong> setelah mengganti ikon. Android akan
              memuat ikon baru saat dashboard dibuka ulang atau ditarik untuk
              refresh; pengguna tidak perlu memperbarui APK lagi.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Banner Mobile Dashboard</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Carousel beranda guru untuk mode mobile. Ukuran gambar boleh lebih tinggi dan padat.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tampilkan</span>
              <Switch
                checked={config.banners.enabled}
                onCheckedChange={(v) =>
                  patch((c) => ({
                    ...c,
                    banners: { ...c.banners, enabled: v },
                  }))
                }
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!config.banners.enabled &&
              config.banners.slides.some((s) => s.isActive && s.mediaUrl.trim()) && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Banner tidak tampil di dashboard guru — nyalakan toggle &quot;Tampilkan&quot;
                  di kanan atas lalu klik Simpan.
                </p>
              )}
            <Field label="Interval autoplay (ms)">
              <Input
                type="number"
                min={2000}
                max={60000}
                step={500}
                value={config.banners.autoPlayMs}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    banners: {
                      ...c.banners,
                      autoPlayMs: Number(e.target.value) || 5000,
                    },
                  }))
                }
              />
            </Field>
            {config.banners.slides.map((slide, i) => (
              <SlideEditor
                key={slide.id}
                slide={slide}
                uploadKind="banner"
                onChange={(s) => updateBannerSlide(i, s)}
                onRemove={() =>
                  patch((c) => ({
                    ...c,
                    banners: {
                      ...c.banners,
                      slides: c.banners.slides.filter((_, j) => j !== i),
                    },
                  }))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                patch((c) => ({
                  ...c,
                  banners: {
                    ...c.banners,
                    slides: [
                      ...c.banners.slides,
                      createMediaSlide({ sortOrder: c.banners.slides.length }),
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Tambah Banner
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Banner Desktop Dashboard</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Banner khusus desktop. Rekomendasi ukuran: 1200 x 375 px atau 1600 x 500 px, rasio 16:5.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tampilkan</span>
              <Switch
                checked={config.desktopBanners.enabled}
                onCheckedChange={(v) =>
                  patch((c) => ({
                    ...c,
                    desktopBanners: { ...c.desktopBanners, enabled: v },
                  }))
                }
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!config.desktopBanners.enabled &&
              config.desktopBanners.slides.some((s) => s.isActive && s.mediaUrl.trim()) && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Banner desktop tidak tampil — nyalakan toggle &quot;Tampilkan&quot;
                  di kanan atas lalu klik Simpan.
                </p>
              )}
            <Field
              label="Interval autoplay (ms)"
              hint="Digunakan khusus carousel desktop."
            >
              <Input
                type="number"
                min={2000}
                max={60000}
                step={500}
                value={config.desktopBanners.autoPlayMs}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    desktopBanners: {
                      ...c.desktopBanners,
                      autoPlayMs: Number(e.target.value) || 5000,
                    },
                  }))
                }
              />
            </Field>
            {config.desktopBanners.slides.map((slide, i) => (
              <SlideEditor
                key={slide.id}
                slide={slide}
                uploadKind="desktop-banner"
                onChange={(s) => updateDesktopBannerSlide(i, s)}
                onRemove={() =>
                  patch((c) => ({
                    ...c,
                    desktopBanners: {
                      ...c.desktopBanners,
                      slides: c.desktopBanners.slides.filter((_, j) => j !== i),
                    },
                  }))
                }
              />
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                patch((c) => ({
                  ...c,
                  desktopBanners: {
                    ...c.desktopBanners,
                    slides: [
                      ...c.desktopBanners.slides,
                      createMediaSlide({
                        sortOrder: c.desktopBanners.slides.length,
                      }),
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-1 h-4 w-4" />
              Tambah Banner Desktop
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Splash Screen</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Splash aplikasi mobile memakai animasi logo Navalogi bawaan dan tidak
              dapat diubah dari Super Admin.
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Popup Ads</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Muncul sekali per sesi login. Kampanye baru akan tampil kembali otomatis.
                Gambar diunggah, video via URL.
              </p>
            </div>
            <Switch
              aria-label="Aktifkan popup ads"
              checked={config.popup.enabled}
              onCheckedChange={(v) =>
                patch((c) => ({
                  ...c,
                  popup: { ...c.popup, enabled: v },
                }))
              }
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {!config.popup.enabled &&
            config.popup.slides.some((slide) => slide.isActive && slide.mediaUrl.trim()) ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Media popup sudah tersedia tetapi popup sedang dinonaktifkan. Nyalakan toggle lalu klik Simpan.
              </p>
            ) : null}
            {config.popup.slides.map((slide, i) => (
              <SlideEditor
                key={slide.id}
                slide={slide}
                uploadKind="popup"
                onChange={(s) => updatePopupSlide(i, s)}
                onRemove={() =>
                  patch((c) => ({
                    ...c,
                    popup: {
                      ...c.popup,
                      slides: c.popup.slides.filter((_, j) => j !== i),
                    },
                  }))
                }
              />
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  patch((c) => ({
                    ...c,
                    popup: {
                      ...c.popup,
                      slides: [
                        ...c.popup.slides,
                        createMediaSlide({ sortOrder: c.popup.slides.length }),
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                Tambah Popup
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={activeSlides(config.popup.slides).length === 0}
                onClick={() => setPopupPreviewOpen(true)}
              >
                <Eye className="mr-1 h-4 w-4" />
                Uji Popup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <DashboardPopupAd
        enabled={popupPreviewOpen}
        revision={config.popup.revision}
        slides={activeSlides(config.popup.slides).map((slide) => ({
          ...slide,
          mediaUrl: toSameOriginUploadUrl(slide.mediaUrl),
        }))}
        previewMode
        onDismiss={() => setPopupPreviewOpen(false)}
      />
    </AdminShell>
  );
}
