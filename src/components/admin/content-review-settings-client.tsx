"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clapperboard, Loader2, Newspaper, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  ContentReviewSettings,
  ContentReviewerRole,
  FeatureReviewSettings,
} from "@/lib/content-review";

const EMPTY: ContentReviewSettings = {
  spotlight: { reviewEnabled: false, reviewerRoles: ["TEACHER", "SCHOOL_ADMIN"] },
  mading: { reviewEnabled: true, reviewerRoles: ["TEACHER", "SCHOOL_ADMIN"] },
};

const ROLE_OPTIONS: Array<{ value: ContentReviewerRole; label: string; help: string }> = [
  {
    value: "TEACHER",
    label: "Guru",
    help: "Guru pengelola kelas / co-teacher yang berwenang pada kelas tersebut.",
  },
  {
    value: "SCHOOL_ADMIN",
    label: "Admin Sekolah",
    help: "Admin sekolah untuk seluruh kelas di sekolah yang sama.",
  },
];

function FeatureCard({
  title,
  description,
  icon,
  value,
  onChange,
  reportMode = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  value: FeatureReviewSettings;
  onChange: (next: FeatureReviewSettings) => void;
  reportMode?: boolean;
}) {
  const toggleRole = (role: ContentReviewerRole, checked: boolean) => {
    const nextRoles = checked
      ? Array.from(new Set([...value.reviewerRoles, role]))
      : value.reviewerRoles.filter((item) => item !== role);
    onChange({ ...value, reviewerRoles: nextRoles });
  };

  return (
    <Card className="rounded-[24px] border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <CardHeader className="border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-950">
              {icon}
              {title}
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <Badge
            className={
              reportMode
                ? "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-50"
                : value.reviewEnabled
                ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
            }
          >
            {reportMode ? "Langsung terbit + laporan" : value.reviewEnabled ? "Review aktif" : "Langsung terbit"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        {reportMode ? (
          <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/70 px-4 py-3">
            <Label className="text-sm font-bold text-fuchsia-950">Moderasi berbasis laporan</Label>
            <p className="mt-1 text-xs leading-5 text-fuchsia-800">
              Zona Kreasi langsung tampil di feed. Pengguna dapat melaporkan konten, lalu moderator
              memutuskan untuk mempertahankan, menyembunyikan, atau menghapusnya.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <Label className="text-sm font-bold text-slate-900">Sistem review</Label>
              <p className="mt-1 text-xs text-slate-500">
                Nonaktifkan agar konten siswa langsung muncul di feed tanpa antrean review.
              </p>
            </div>
            <Switch
              checked={value.reviewEnabled}
              onCheckedChange={(checked) => onChange({ ...value, reviewEnabled: checked })}
            />
          </div>
        )}

        <div className="space-y-3">
          <div>
            <Label className="text-sm font-bold text-slate-900">
              {reportMode ? "Siapa yang memoderasi laporan" : "Siapa yang mereview"}
            </Label>
            <p className="mt-1 text-xs text-slate-500">
              Super Admin selalu memiliki akses. Pilih minimal satu role di bawah.
            </p>
          </div>
          {ROLE_OPTIONS.map((option) => {
            const checked = value.reviewerRoles.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-blue-600"
                  checked={checked}
                  onChange={(event) => toggleRole(option.value, event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-bold text-slate-900">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{option.help}</span>
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentReviewSettingsClient() {
  const [settings, setSettings] = useState<ContentReviewSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/content-review")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Gagal memuat pengaturan.");
        if (active) setSettings(data.settings);
      })
      .catch((error) => active && setMessage({ tone: "error", text: error.message }))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/content-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");
      setSettings(data.settings);
      setMessage({ tone: "ok", text: data.message || "Pengaturan tersimpan." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Gagal menyimpan.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Moderasi Konten</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
          Moderasi Zona Kreasi & Review Mading
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Zona Kreasi langsung terbit dan dimoderasi melalui laporan pengguna. Mading tetap dapat
          direview sebelum tampil di feed.
        </p>
      </div>

      {message ? (
        <div
          className={
            message.tone === "ok"
              ? "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              : "rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          }
        >
          {message.text}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat pengaturan...
        </div>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-2">
            <FeatureCard
              title="Zona Kreasi Siswa"
              description="Video singkat siswa di portal Zona Kreasi."
              icon={<Clapperboard className="h-4 w-4 text-fuchsia-600" />}
              value={settings.spotlight}
              onChange={(spotlight) => setSettings((prev) => ({ ...prev, spotlight }))}
              reportMode
            />
            <FeatureCard
              title="Mading Siswa"
              description="Karya teks/gambar di portal Mading."
              icon={<Newspaper className="h-4 w-4 text-emerald-600" />}
              value={settings.mading}
              onChange={(mading) => setSettings((prev) => ({ ...prev, mading }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="inline-flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Super Admin selalu dapat melakukan moderasi terlepas dari checklist role.
            </p>
            <Button onClick={() => void save()} disabled={saving} className="rounded-xl">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Pengaturan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
