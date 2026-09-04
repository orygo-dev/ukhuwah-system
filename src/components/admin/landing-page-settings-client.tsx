"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeLandingPage,
  LANDING_ICON_OPTIONS,
  type LandingPageConfig,
} from "@/lib/landing-page.shared";
import { landingPageSchema } from "@/lib/landing-page.schema";
import { readResponseJson } from "@/lib/http-json";

async function requestConfig(controller: AbortController, body?: object) {
  const timeout = setTimeout(
    () =>
      controller.abort(
        new Error("Permintaan melewati batas waktu. Silakan coba lagi."),
      ),
    20_000,
  );
  try {
    const res = await fetch("/api/admin/landing-page", {
      method: body ? "PATCH" : "GET",
      signal: controller.signal,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const data = await readResponseJson<{ config?: LandingPageConfig }>(res);
    if (!res.ok || !data.config)
      throw new Error(data.error || "Gagal memuat pengaturan landing page.");
    return normalizeLandingPage(data.config);
  } finally {
    clearTimeout(timeout);
  }
}

export function AdminLandingPageClient() {
  const [config, setConfig] = useState<LandingPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    request.current = controller;
    let active = true;
    requestConfig(controller)
      .then((value) => {
        if (active) setConfig(value);
      })
      .catch((error) => {
        if (active) {
          setFailed(true);
          setMessage(
            error instanceof Error ? error.message : "Gagal memuat pengaturan.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
        if (request.current === controller) request.current = null;
      });
    return () => {
      active = false;
      mounted.current = false;
      controller.abort();
      request.current?.abort();
      request.current = null;
    };
  }, [attempt]);

  const change = (path: string, value: string) => {
    setConfig((previous) => {
      if (!previous) return previous;
      const next = structuredClone(previous);
      const parts = path.split(".");
      let target = next as unknown as Record<string, unknown>;
      for (const key of parts.slice(0, -1))
        target = target[key] as Record<string, unknown>;
      target[parts[parts.length - 1]] = value;
      return next;
    });
    setMessage("");
  };
  const field = (
    label: string,
    path: string,
    multiline = false,
    maxLength = 160,
  ) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (object, key) => (object as Record<string, unknown>)?.[key],
        config,
      );
    const id = "landing-" + path.replaceAll(".", "-");
    return (
      <div key={path} className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {multiline ? (
          <Textarea
            id={id}
            value={typeof value === "string" ? value : ""}
            rows={3}
            maxLength={maxLength}
            onChange={(e) => change(path, e.target.value)}
          />
        ) : (
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            maxLength={maxLength}
            onChange={(e) => change(path, e.target.value)}
          />
        )}
      </div>
    );
  };
  const save = async (reset = false) => {
    if (!config || request.current) return;
    if (
      reset &&
      !window.confirm(
        "Kembalikan konten landing page ke desain default? Pengaturan nama/logo dan paket berlangganan tidak berubah.",
      )
    )
      return;
    if (!reset) {
      const validation = landingPageSchema.safeParse(config);
      if (!validation.success) {
        setFailed(true);
        setMessage(
          validation.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join(" · "),
        );
        return;
      }
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const value = await requestConfig(
        controller,
        reset ? { action: "reset" } : config,
      );
      if (mounted.current) {
        setConfig(value);
        setMessage(
          reset
            ? "Konten default berhasil diterapkan."
            : "Landing page berhasil disimpan.",
        );
      }
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setMessage(error instanceof Error ? error.message : "Gagal menyimpan.");
      }
    } finally {
      if (request.current === controller) request.current = null;
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <AdminShell activePath="/admin/landing-page">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Landing Page</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Konten halaman publik. Nama dan logo mengikuti{" "}
              <Link className="underline" href="/admin/app-display">
                pengaturan tampilan aplikasi
              </Link>
              .
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/" target="_blank" rel="noopener noreferrer">
              Lihat Halaman
            </Link>
          </Button>
        </div>
        {message && (
          <p
            role={failed ? "alert" : "status"}
            className="rounded-lg border p-4 text-sm"
          >
            {message}
          </p>
        )}
        {loading ? (
          <p role="status" className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin" />
            Memuat pengaturan…
          </p>
        ) : !config ? (
          <Button
            onClick={() => {
              setLoading(true);
              setMessage("");
              setAttempt((v) => v + 1);
            }}
          >
            Coba lagi
          </Button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
              <legend className="sr-only">
                Pengaturan konten landing page
              </legend>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={busy}>
                  {busy ? (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  Simpan Perubahan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void save(true)}
                  disabled={busy}
                >
                  <RotateCcw data-icon="inline-start" />
                  Reset Default
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Bagian utama</CardTitle>
                  <CardDescription>
                    Judul, deskripsi, dan kedua tombol ini ditampilkan langsung
                    di halaman depan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {field("Judul utama", "hero.title")}
                  {field("Judul berwarna", "hero.titleHighlight", false, 120)}
                  {field("Deskripsi", "hero.subtitle", true, 800)}
                  {field(
                    "Label tombol utama",
                    "hero.primaryCta.label",
                    false,
                    80,
                  )}
                  {field(
                    "Tautan tombol utama",
                    "hero.primaryCta.href",
                    false,
                    500,
                  )}
                  {field(
                    "Label tombol kedua",
                    "hero.secondaryCta.label",
                    false,
                    80,
                  )}
                  {field(
                    "Tautan tombol kedua",
                    "hero.secondaryCta.href",
                    false,
                    500,
                  )}
                  {field("Label masuk", "header.loginLabel", false, 40)}
                  {field(
                    "Label daftar guru",
                    "header.registerLabel",
                    false,
                    40,
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Peran pengguna</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {field("Judul bagian", "features.title")}
                  {field(
                    "Deskripsi tambahan (opsional)",
                    "features.subtitle",
                    true,
                    800,
                  )}
                  {config.features.items.map((_, i) => (
                    <fieldset
                      key={i}
                      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
                    >
                      <legend className="px-2 text-sm">Peran {i + 1}</legend>
                      {field(
                        "Nama peran",
                        `features.items.${i}.title`,
                        false,
                        120,
                      )}
                      {field(
                        "Penjelasan",
                        `features.items.${i}.description`,
                        true,
                        500,
                      )}
                      <label className="flex flex-col gap-2 text-sm">
                        Ikon
                        <select
                          className="h-10 rounded-md border bg-background px-3"
                          value={config.features.items[i].icon}
                          onChange={(e) =>
                            change(`features.items.${i}.icon`, e.target.value)
                          }
                        >
                          {!LANDING_ICON_OPTIONS.some(
                            (option) =>
                              option.value === config.features.items[i].icon,
                          ) && (
                            <option value={config.features.items[i].icon}>
                              {config.features.items[i].icon}
                            </option>
                          )}
                          {LANDING_ICON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={config.features.items.length <= 1}
                        onClick={() => {
                          setConfig((c) =>
                            c
                              ? {
                                  ...c,
                                  features: {
                                    ...c.features,
                                    items: c.features.items.filter(
                                      (_, index) => index !== i,
                                    ),
                                  },
                                }
                              : c,
                          );
                          setMessage("");
                        }}
                      >
                        Hapus peran {i + 1}
                      </Button>
                    </fieldset>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={config.features.items.length >= 8}
                    onClick={() => {
                      setConfig((c) =>
                        c
                          ? {
                              ...c,
                              features: {
                                ...c.features,
                                items: [
                                  ...c.features.items,
                                  {
                                    icon: "UserRound",
                                    title: "Peran baru",
                                    description: "",
                                  },
                                ],
                              },
                            }
                          : c,
                      );
                      setMessage("");
                    }}
                  >
                    Tambah peran
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Alur pembelajaran</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {field("Judul bagian", "steps.title")}
                  {config.steps.items.map((_, i) => (
                    <fieldset
                      key={i}
                      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
                    >
                      <legend className="px-2 text-sm">Langkah {i + 1}</legend>
                      {field("Judul", `steps.items.${i}.title`, false, 120)}
                      {field(
                        "Penjelasan",
                        `steps.items.${i}.description`,
                        true,
                        500,
                      )}
                    </fieldset>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Fitur dan peran pengguna</CardTitle>
                  <CardDescription>
                    Jelaskan manfaat untuk guru, sekolah, dan orang tua. Akses
                    mengikuti peran di yayasan, bukan paket langganan publik.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {field("Judul bagian fitur", "experience.heading")}
                  {field("Judul bagian peran", "pricing.title")}
                  {field("Keterangan peran", "pricing.subtitle", true, 800)}
                  {(
                    [
                      "classroom",
                      "ai",
                      "teacher",
                      "school",
                      "parent",
                    ] as const
                  ).map((key, i) => (
                    <fieldset
                      key={key}
                      className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
                    >
                      <legend className="px-2 text-sm">
                        {
                          [
                            "Kegiatan kelas",
                            "Bantuan perangkat ajar",
                            "Untuk Guru",
                            "Untuk Sekolah",
                            "Untuk Orang Tua",
                          ][i]
                        }
                      </legend>
                      {field("Judul", `experience.${key}.title`)}
                      {field(
                        "Deskripsi",
                        `experience.${key}.description`,
                        true,
                        500,
                      )}
                      {field(
                        "Label tombol",
                        `experience.${key}.link.label`,
                        false,
                        80,
                      )}
                      {field(
                        "Tautan tombol",
                        `experience.${key}.link.href`,
                        false,
                        500,
                      )}
                    </fieldset>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Akses web dan Android</CardTitle>
                  <CardDescription>
                    Isi tautan aplikasi resmi bila tersedia. Jika kosong, tombol
                    akan membuka panduan akses siswa. Tidak membuat pendaftaran
                    siswa baru.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {field("Judul", "experience.app.title")}
                  {field(
                    "URL resmi aplikasi Android (HTTPS)",
                    "experience.app.androidUrl",
                    false,
                    500,
                  )}
                  {field(
                    "Penjelasan web",
                    "experience.app.webDescription",
                    true,
                    500,
                  )}
                  {field(
                    "Penjelasan Android",
                    "experience.app.androidDescription",
                    true,
                    500,
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Ajakan penutup dan footer</CardTitle>
                  <CardDescription>
                    Gunakan {"{appName}"} pada label tombol untuk mengikuti nama
                    aplikasi dari Super Admin.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {field("Judul penutup", "cta.title")}
                  {field("Deskripsi (opsional)", "cta.subtitle", true, 800)}
                  {field("Label tombol", "cta.button.label", false, 80)}
                  {field("Tautan tombol", "cta.button.href", false, 500)}
                  {field("Deskripsi footer", "footer.description", true, 500)}
                </CardContent>
              </Card>
              <details className="rounded-lg border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Konten tambahan dan kompatibilitas pengaturan lama
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    Badge, catatan, dan statistik khusus tetap dipertahankan
                    bila pernah diisi. Default desain baru tidak menggunakan
                    klaim statistik. Daftar harga statis lama tetap tersimpan,
                    tetapi tidak dipublikasikan agar tidak berbeda dari paket
                    aktif.
                  </p>
                  {field(
                    "Teks di atas judul (opsional)",
                    "hero.badge",
                    false,
                    120,
                  )}
                  {field(
                    "Catatan tambahan (opsional)",
                    "hero.trustLine",
                    true,
                    500,
                  )}
                  {config.hero.stats.map((_, i) => (
                    <div className="grid gap-3 sm:grid-cols-2" key={i}>
                      {field("Nilai", `hero.stats.${i}.value`, false, 80)}
                      {field("Label", `hero.stats.${i}.label`, false, 120)}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setConfig((c) =>
                            c
                              ? {
                                  ...c,
                                  hero: {
                                    ...c.hero,
                                    stats: c.hero.stats.filter(
                                      (_, index) => index !== i,
                                    ),
                                  },
                                }
                              : c,
                          );
                          setMessage("");
                        }}
                      >
                        Hapus statistik {i + 1}
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={config.hero.stats.length >= 6}
                    onClick={() => {
                      setConfig((c) =>
                        c
                          ? {
                              ...c,
                              hero: {
                                ...c.hero,
                                stats: [
                                  ...c.hero.stats,
                                  { value: "", label: "" },
                                ],
                              },
                            }
                          : c,
                      );
                      setMessage("");
                    }}
                  >
                    Tambah statistik
                  </Button>
                </div>
              </details>
              <Button type="submit" disabled={busy} className="self-start">
                {busy ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Save data-icon="inline-start" />
                )}
                Simpan Perubahan
              </Button>
            </fieldset>
          </form>
        )}
      </div>
    </AdminShell>
  );
}
