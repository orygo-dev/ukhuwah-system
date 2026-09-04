"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Flag, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { STUDENT_SPOTLIGHT_REPORT_LABELS } from "@/lib/student-spotlight-reports";

type Report = {
  id: string;
  reason: keyof typeof STUDENT_SPOTLIGHT_REPORT_LABELS;
  details: string | null;
  status: "OPEN" | "DISMISSED" | "ACTIONED";
  createdAt: string;
  reporter: { id: string; name: string };
};

type ReportedSpotlight = {
  id: string;
  caption: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  status: "PUBLISHED" | "ARCHIVED" | "REJECTED" | string;
  autoHidden: boolean;
  reportCount: number;
  openReportCount: number;
  student: { id: string; name: string };
  classRoom: { id: string; name: string };
  reports: Report[];
};

type ModerationAction = "KEEP" | "HIDE" | "RESTORE" | "REMOVE";

function isImage(value: string) {
  return /\.(jpe?g|png|webp)(?:\?.*)?$/i.test(value);
}
export function StudentSpotlightReportsPanel() {
  const [items, setItems] = useState<ReportedSpotlight[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/student-spotlight/reports", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat laporan Zona Kreasi.");
      setItems(data.items || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat laporan Zona Kreasi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const openItems = useMemo(
    () => items.filter((item) => item.openReportCount > 0),
    [items]
  );
  const history = useMemo(
    () => items.filter((item) => item.openReportCount === 0),
    [items]
  );

  const moderate = async (item: ReportedSpotlight, action: ModerationAction) => {
    const note = notes[item.id]?.trim() || "";
    if ((action === "HIDE" || action === "REMOVE") && !note) {
      setError("Catatan wajib diisi sebelum menyembunyikan atau menghapus konten.");
      return;
    }
    setActingId(item.id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/student-spotlight/reports/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tindakan moderasi gagal.");
      setMessage(data.message || "Laporan berhasil ditangani.");
      setNotes((current) => ({ ...current, [item.id]: "" }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tindakan moderasi gagal.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-[0_22px_60px_rgba(127,29,29,0.07)]">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="bg-red-600 text-white hover:bg-red-600">
              <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Moderasi Zona Kreasi
            </Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              Laporan dari Pengguna
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Zona Kreasi langsung terbit. Periksa laporan secara adil; identitas pelapor hanya terlihat
              oleh moderator dan tidak dibagikan kepada pembuat konten.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-50 px-4 py-3 text-center">
              <p className="text-2xl font-black text-red-700">{openItems.length}</p>
              <p className="text-[11px] font-bold uppercase text-red-600">Perlu tindakan</p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Segarkan
            </Button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div> : null}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : openItems.length === 0 ? (
        <Card className="rounded-[24px] border-emerald-100 bg-white">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
            <h2 className="text-lg font-black text-slate-950">Tidak ada laporan terbuka</h2>
            <p className="mt-2 text-sm text-slate-500">Semua laporan Zona Kreasi sudah ditangani.</p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-slate-950">Memerlukan Pemeriksaan</h2>
            <Badge className="bg-red-50 text-red-700 hover:bg-red-50">{openItems.length} konten</Badge>
          </div>
          {openItems.map((item) => (
            <ReportedCard
              key={item.id}
              item={item}
              note={notes[item.id] || ""}
              acting={actingId === item.id}
              onNote={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
              onAction={(action) => void moderate(item, action)}
            />
          ))}
        </section>
      )}

      {!loading && history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-black text-slate-950">Riwayat Moderasi</h2>
          {history.map((item) => (
            <Card key={item.id} className="rounded-[22px] border-slate-100 bg-white">
              <CardContent className="flex flex-wrap items-center gap-3 p-4">
                <Badge variant="outline">{item.status}</Badge>
                <span className="font-bold text-slate-900">{item.student.name}</span>
                <span className="text-sm text-slate-500">{item.reportCount} laporan · {item.classRoom.name}</span>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function ReportedCard({ item, note, acting, onNote, onAction }: {
  item: ReportedSpotlight;
  note: string;
  acting: boolean;
  onNote: (value: string) => void;
  onAction: (action: ModerationAction) => void;
}) {
  return (
    <Card className="rounded-[24px] border-red-100 bg-white shadow-[0_16px_40px_rgba(127,29,29,0.06)]">
      <CardContent className="grid gap-5 p-5 xl:grid-cols-[240px_1fr]">
        <div className="overflow-hidden rounded-2xl bg-slate-950">
          {isImage(item.videoUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.videoUrl} alt={`Zona Kreasi ${item.student.name}`} className="aspect-[9/13] w-full object-cover" />
          ) : (
            <video src={item.videoUrl} poster={item.thumbnailUrl || undefined} controls playsInline preload="metadata" className="aspect-[9/13] w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-red-50 text-red-700 hover:bg-red-50"><Flag className="mr-1 h-3.5 w-3.5" />{item.openReportCount} laporan terbuka</Badge>
            <Badge variant="secondary">{item.classRoom.name}</Badge>
            {item.autoHidden ? <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">Disembunyikan otomatis</Badge> : null}
          </div>
          <div>
            <p className="font-black text-slate-950">{item.student.name}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{item.caption}</p>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {item.reports.filter((report) => report.status === "OPEN").map((report) => (
              <div key={report.id} className="rounded-2xl border border-red-100 bg-red-50/60 p-3 text-sm">
                <p className="font-extrabold text-red-900">{STUDENT_SPOTLIGHT_REPORT_LABELS[report.reason] || report.reason}</p>
                <p className="mt-1 text-xs text-slate-600">Pelapor: {report.reporter.name}</p>
                {report.details ? <p className="mt-2 leading-5 text-slate-700">{report.details}</p> : null}
              </div>
            ))}
          </div>
          <Textarea value={note} onChange={(event) => onNote(event.target.value)} rows={3} placeholder="Catatan moderator (wajib untuk sembunyikan/hapus)" />
          <div className="flex flex-wrap gap-2">
            <Button disabled={acting} onClick={() => onAction(item.autoHidden ? "RESTORE" : "KEEP")}>
              <Eye className="mr-1 h-4 w-4" /> {item.autoHidden ? "Pulihkan" : "Tetap Tampilkan"}
            </Button>
            <Button variant="outline" disabled={acting} onClick={() => onAction("HIDE")}>
              <EyeOff className="mr-1 h-4 w-4" /> Sembunyikan
            </Button>
            <Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={acting} onClick={() => onAction("REMOVE")}>
              <Trash2 className="mr-1 h-4 w-4" /> Hapus dari Feed
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
