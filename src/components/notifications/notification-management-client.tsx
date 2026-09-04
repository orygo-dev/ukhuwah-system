"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  BellRing,
  CalendarClock,
  CheckCircle2,
  FilePenLine,
  ImagePlus,
  Loader2,
  Megaphone,
  Send,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toSameOriginUploadUrl } from "@/lib/upload-url";
import { NotificationCenterClient } from "./notification-center-client";

type TargetType = "ALL" | "ROLE" | "SCHOOL" | "CLASS";
type PublicationMode = "NOW" | "SCHEDULED";
type FormState = {
  title: string;
  message: string;
  category: string;
  priority: string;
  targetType: TargetType;
  targetRole: string;
  schoolId: string;
  classRoomId: string;
  actionUrl: string;
  imageUrl: string;
  publishAt: string;
  expiresAt: string;
};

type ManageData = {
  actor: { role: string; schoolName: string | null };
  options: {
    targetTypes: TargetType[];
    roles: string[];
    schools: Array<{ id: string; name: string; npsn?: string | null; city?: string | null }>;
    classes: Array<{ id: string; name: string; schoolId: string | null }>;
  };
  items: Array<{
    id: string;
    title: string;
    message: string;
    category: string;
    priority: string;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    targetLabel: string;
    actionUrl: string | null;
    imageUrl: string | null;
    publishAt: string;
    expiresAt: string | null;
    createdAt: string;
    sender: { id: string; name: string; role: string };
    _count: { recipients: number };
    readCount: number;
  }>;
};

const INITIAL_FORM: FormState = {
  title: "",
  message: "",
  category: "GENERAL",
  priority: "NORMAL",
  targetType: "ALL",
  targetRole: "STUDENT",
  schoolId: "",
  classRoomId: "",
  actionUrl: "",
  imageUrl: "",
  publishAt: "",
  expiresAt: "",
};

const CATEGORY_OPTIONS = [
  ["GENERAL", "Pengumuman umum"],
  ["ACADEMIC", "Akademik"],
  ["ASSIGNMENT", "Tugas"],
  ["TKA", "TKA"],
  ["PJJ", "PJJ"],
  ["READING", "Zona Baca"],
  ["ADMINISTRATION", "Administrasi"],
  ["EVENT", "Agenda"],
];

const ROLE_LABELS: Record<string, string> = {
  PROVINCE_ADMIN: "Admin Dinas",
  SCHOOL_ADMIN: "Admin Sekolah",
  TEACHER: "Guru",
  STUDENT: "Siswa",
};

const TARGET_LABELS: Record<TargetType, string> = {
  ALL: "Semua dalam kewenangan",
  ROLE: "Role tertentu",
  SCHOOL: "Sekolah tertentu",
  CLASS: "Kelas tertentu",
};

export function NotificationManagementClient() {
  const [data, setData] = useState<ManageData | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [publicationMode, setPublicationMode] = useState<PublicationMode>("NOW");
  const [tab, setTab] = useState<"create" | "sent" | "inbox">("create");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"DRAFT" | "PUBLISHED" | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localImagePreview, setLocalImagePreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/notifications/manage", { cache: "no-store" });
    if (response.ok) {
      const nextData = (await response.json()) as ManageData;
      setData(nextData);
      setForm((current) => ({
        ...current,
        targetType: nextData.options.targetTypes.includes(current.targetType) ? current.targetType : nextData.options.targetTypes[0],
        targetRole: nextData.options.roles.includes(current.targetRole) ? current.targetRole : nextData.options.roles[0] ?? "STUDENT",
        classRoomId: current.classRoomId || nextData.options.classes[0]?.id || "",
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "inbox" || requested === "sent" || requested === "create") setTab(requested);
    return () => {
      setLocalImagePreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, [load]);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const updatePublicationMode = (mode: PublicationMode) => {
    setPublicationMode(mode);
    if (mode === "NOW") {
      setForm((current) => ({ ...current, publishAt: "" }));
    }
  };

  const clearLocalImagePreview = () => {
    setLocalImagePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const uploadImage = async (file: File | null) => {
    if (!file) return;
    setUploadingImage(true);
    setMessage(null);
    clearLocalImagePreview();
    const objectUrl = URL.createObjectURL(file);
    setLocalImagePreview(objectUrl);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/notifications/upload", {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal mengunggah gambar");
      update("imageUrl", toSameOriginUploadUrl(result.url || ""));
    } catch (error) {
      clearLocalImagePreview();
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Gagal mengunggah gambar",
      });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const submit = async (event: FormEvent, status: "DRAFT" | "PUBLISHED") => {
    event.preventDefault();
    setSubmitting(status);
    setMessage(null);
    if (publicationMode === "SCHEDULED" && !form.publishAt) {
      setMessage({ type: "error", text: "Pilih waktu publikasi untuk pemberitahuan terjadwal." });
      setSubmitting(null);
      return;
    }
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status,
        targetRole: form.targetType === "ROLE" ? form.targetRole : null,
        schoolId: form.targetType === "SCHOOL" ? form.schoolId : null,
        classRoomId: form.targetType === "CLASS" ? form.classRoomId : null,
        actionUrl: form.actionUrl || null,
        imageUrl: form.imageUrl || null,
        publishAt:
          publicationMode === "SCHEDULED" && form.publishAt
            ? new Date(form.publishAt).toISOString()
            : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage({ type: "success", text: status === "DRAFT" ? "Draf berhasil disimpan." : `Pemberitahuan berhasil disiapkan untuk ${result.notification?._count?.recipients ?? 0} penerima.` });
      setForm((current) => ({ ...INITIAL_FORM, targetType: data?.options.targetTypes[0] ?? "ALL", targetRole: data?.options.roles[0] ?? "STUDENT", classRoomId: data?.options.classes[0]?.id ?? "" }));
      setPublicationMode("NOW");
      clearLocalImagePreview();
      await load();
      setTab("sent");
    } else {
      setMessage({ type: "error", text: result.error ?? "Pemberitahuan gagal disimpan." });
    }
    setSubmitting(null);
  };

  const changeStatus = async (id: string, action: "publish" | "archive") => {
    setMessage(null);
    const response = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    setMessage(response.ok ? { type: "success", text: action === "publish" ? "Draf berhasil diterbitkan." : "Pemberitahuan diarsipkan." } : { type: "error", text: result.error ?? "Perubahan gagal." });
    if (response.ok) await load();
  };

  const sent = data?.items ?? [];
  const totalRecipients = sent.reduce((total, item) => total + item._count.recipients, 0);
  const totalRead = sent.reduce((total, item) => total + item.readCount, 0);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-xl shadow-blue-950/10 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-200">Pusat Informasi Resmi</p>
            <h1 className="mt-2 text-3xl font-black lg:text-4xl">Kelola Pemberitahuan</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">Kirim informasi yang tepat kepada penerima dalam kewenangan Anda dan pantau keterbacaannya.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-black">{sent.length}</p><p className="text-[10px] font-bold text-emerald-100">Dibuat</p></div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-black">{totalRecipients}</p><p className="text-[10px] font-bold text-emerald-100">Penerima</p></div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xl font-black">{totalRecipients ? Math.round((totalRead / totalRecipients) * 100) : 0}%</p><p className="text-[10px] font-bold text-emerald-100">Dibaca</p></div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {([
          ["create", "Buat", Megaphone],
          ["sent", "Terkirim", Send],
          ["inbox", "Kotak Masuk", BellRing],
        ] as const).map(([value, label, Icon]) => (
          <Button key={value} type="button" variant={tab === value ? "default" : "ghost"} className="rounded-xl" onClick={() => setTab(value)}><Icon className="h-4 w-4" /> {label}</Button>
        ))}
      </div>

      {message ? <div className={cn("rounded-2xl border px-4 py-3 text-sm font-bold", message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700")}>{message.text}</div> : null}

      {tab === "inbox" ? <NotificationCenterClient embedded /> : null}

      {tab === "create" ? (
        <form onSubmit={(event) => submit(event, "PUBLISHED")} className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <Card className="rounded-[28px]">
            <CardHeader><CardTitle className="flex items-center gap-2"><FilePenLine className="h-5 w-5 text-emerald-600" /> Isi Pemberitahuan</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2"><Label htmlFor="notification-title">Judul</Label><Input id="notification-title" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Contoh: Jadwal TKA pekan depan" maxLength={120} required /></div>
              <div className="space-y-2"><Label htmlFor="notification-message">Isi pemberitahuan</Label><Textarea id="notification-message" value={form.message} onChange={(event) => update("message", event.target.value)} placeholder="Tuliskan informasi yang jelas, ringkas, dan dapat ditindaklanjuti." className="min-h-36" maxLength={4000} required /></div>
              <div className="space-y-2">
                <Label>Gambar pemberitahuan (opsional)</Label>
                <p className="text-xs text-slate-500">
                  Gambar ini bisa ditampilkan pada push notifikasi Android (big picture).
                </p>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => void uploadImage(event.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={uploadingImage}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    {uploadingImage ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : form.imageUrl ? (
                      <Upload className="mr-1 h-4 w-4" />
                    ) : (
                      <ImagePlus className="mr-1 h-4 w-4" />
                    )}
                    {form.imageUrl ? "Ganti gambar" : "Unggah gambar"}
                  </Button>
                  {form.imageUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-red-600"
                      onClick={() => {
                        clearLocalImagePreview();
                        update("imageUrl", "");
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Hapus
                    </Button>
                  ) : null}
                </div>
                {localImagePreview || form.imageUrl ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={localImagePreview || toSameOriginUploadUrl(form.imageUrl)}
                      alt="Pratinjau gambar pemberitahuan"
                      className="max-h-56 w-full object-contain"
                    />
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="notification-category">Kategori</Label><select id="notification-category" value={form.category} onChange={(event) => update("category", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="notification-priority">Prioritas</Label><select id="notification-priority" value={form.priority} onChange={(event) => update("priority", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="NORMAL">Normal</option><option value="IMPORTANT">Penting</option><option value="URGENT">Mendesak</option></select></div>
              </div>
              <div className="space-y-2"><Label htmlFor="notification-action">Tautan tujuan (opsional)</Label><Input id="notification-action" value={form.actionUrl} onChange={(event) => update("actionUrl", event.target.value)} placeholder="/student/tka atau https://..." /></div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-[28px]"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /> Target Penerima</CardTitle></CardHeader><CardContent className="space-y-4">
              {loading ? <p className="text-sm text-slate-500">Memuat target...</p> : null}
              <div className="space-y-2"><Label htmlFor="notification-target">Jenis target</Label><select id="notification-target" value={form.targetType} onChange={(event) => update("targetType", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{data?.options.targetTypes.map((type) => <option key={type} value={type}>{TARGET_LABELS[type]}</option>)}</select></div>
              {form.targetType === "ROLE" ? <div className="space-y-2"><Label htmlFor="notification-role">Role</Label><select id="notification-role" value={form.targetRole} onChange={(event) => update("targetRole", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{data?.options.roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] ?? role}</option>)}</select></div> : null}
              {form.targetType === "SCHOOL" ? <div className="space-y-2"><Label htmlFor="notification-school">Sekolah</Label><select id="notification-school" value={form.schoolId} onChange={(event) => update("schoolId", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Pilih sekolah</option>{data?.options.schools.map((school) => <option key={school.id} value={school.id}>{school.name}{school.npsn ? ` · ${school.npsn}` : ""}</option>)}</select></div> : null}
              {form.targetType === "CLASS" ? <div className="space-y-2"><Label htmlFor="notification-class">Kelas</Label><select id="notification-class" value={form.classRoomId} onChange={(event) => update("classRoomId", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Pilih kelas</option>{data?.options.classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div> : null}
            </CardContent></Card>

            <Card className="rounded-[28px]"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-600" /> Waktu Publikasi</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-2">
                <Button
                  type="button"
                  variant={publicationMode === "NOW" ? "default" : "ghost"}
                  className="rounded-xl"
                  onClick={() => updatePublicationMode("NOW")}
                >
                  Kirim sekarang
                </Button>
                <Button
                  type="button"
                  variant={publicationMode === "SCHEDULED" ? "default" : "ghost"}
                  className="rounded-xl"
                  onClick={() => updatePublicationMode("SCHEDULED")}
                >
                  Jadwalkan
                </Button>
              </div>
              {publicationMode === "SCHEDULED" ? (
                <div className="space-y-2">
                  <Label htmlFor="notification-publish">Jadwalkan publikasi</Label>
                  <Input
                    id="notification-publish"
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(event) => update("publishAt", event.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Pilih waktu publikasi jika pemberitahuan tidak ingin dikirim sekarang.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
                  Pemberitahuan akan langsung terbit dan dikirim setelah Anda menekan tombol
                  <span className="font-bold"> Terbitkan</span>.
                </div>
              )}
              <div className="space-y-2"><Label htmlFor="notification-expiry">Berakhir pada (opsional)</Label><Input id="notification-expiry" type="datetime-local" value={form.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} /></div>
            </CardContent></Card>

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="rounded-xl" disabled={Boolean(submitting)} onClick={(event) => submit(event as unknown as FormEvent, "DRAFT")}>{submitting === "DRAFT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePenLine className="h-4 w-4" />} Simpan draf</Button>
              <Button type="submit" className="rounded-xl" disabled={Boolean(submitting)}>{submitting === "PUBLISHED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Terbitkan</Button>
            </div>
          </div>
        </form>
      ) : null}

      {tab === "sent" ? (
        <div className="space-y-3">
          {sent.length === 0 ? <Card className="rounded-[24px] border-dashed"><CardContent className="p-10 text-center text-sm text-slate-500">Belum ada pemberitahuan yang dibuat.</CardContent></Card> : null}
          {sent.map((item) => {
            const scheduled = item.status === "PUBLISHED" && new Date(item.publishAt) > new Date();
            const readRate = item._count.recipients ? Math.round((item.readCount / item._count.recipients) * 100) : 0;
            return (
              <Card key={item.id} className="rounded-[24px]"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge className={cn("rounded-full", item.status === "ARCHIVED" ? "bg-slate-500" : item.status === "DRAFT" ? "bg-amber-500" : "bg-emerald-600")}>{item.status === "ARCHIVED" ? "Diarsipkan" : item.status === "DRAFT" ? "Draf" : scheduled ? "Terjadwal" : "Terbit"}</Badge><Badge variant="outline" className="rounded-full">{item.targetLabel}</Badge>{item.imageUrl ? <Badge variant="outline" className="rounded-full">Ada gambar</Badge> : null}</div><h2 className="mt-3 text-lg font-black text-slate-950">{item.title}</h2><p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.message}</p>{item.imageUrl ? <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={toSameOriginUploadUrl(item.imageUrl)} alt="" className="max-h-40 w-full object-cover" /></div> : null}<p className="mt-3 text-xs font-bold text-slate-400">Oleh {item.sender.name} · {new Date(item.publishAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div><div className="grid min-w-60 grid-cols-2 gap-2"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black">{item._count.recipients}</p><p className="text-xs font-bold text-slate-500">Penerima</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xl font-black text-emerald-700">{readRate}%</p><p className="text-xs font-bold text-emerald-700">Dibaca</p></div></div></div><div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">{item.status === "DRAFT" ? <Button type="button" size="sm" className="rounded-xl" onClick={() => changeStatus(item.id, "publish")}><CheckCircle2 className="h-4 w-4" /> Terbitkan</Button> : null}{item.status !== "ARCHIVED" ? <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => changeStatus(item.id, "archive")}><Archive className="h-4 w-4" /> Arsipkan</Button> : null}</div></CardContent></Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
