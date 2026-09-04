"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clapperboard, Clock3, Loader2, Newspaper, PenLine, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StudentSpotlightReportsPanel } from "@/components/student-spotlight/student-spotlight-reports-panel";

type Feature = "mading" | "spotlight";
type ReviewStatus = "PENDING_REVIEW" | "PUBLISHED" | "REVISION_REQUESTED" | "REJECTED" | "ARCHIVED";
type ReviewItem = {
  id: string;
  feature: Feature;
  title: string;
  content: string;
  status: ReviewStatus;
  reviewNote?: string | null;
  createdAt: string;
  classRoom: { name: string };
  student?: { name: string } | null;
  author?: { name?: string | null } | null;
};
type MadingApiItem = Omit<ReviewItem, "feature">;
const labels: Record<ReviewStatus, string> = {
  PENDING_REVIEW: "Menunggu review",
  PUBLISHED: "Terbit",
  REVISION_REQUESTED: "Perlu revisi",
  REJECTED: "Ditolak",
  ARCHIVED: "Diarsipkan",
};

export function SchoolContentReviewClient() {
  const [feature, setFeature] = useState<Feature>("mading");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const madingRes = await fetch("/api/student-board/posts");
      const madingData = await madingRes.json();
      if (!madingRes.ok) throw new Error(madingData.error || "Gagal memuat mading siswa");
      const mading: ReviewItem[] = ((madingData.posts || []) as MadingApiItem[]).map((item) => ({
        ...item,
        feature: "mading",
        title: item.title,
        content: item.content,
      }));
      setItems(mading);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat antrean review.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => void load(), [load]);

  const selected = useMemo(() => items.filter((item) => item.feature === feature), [feature, items]);
  const pending = selected.filter((item) => item.status === "PENDING_REVIEW");
  const history = selected.filter((item) => item.status !== "PENDING_REVIEW" && item.status !== "ARCHIVED");
  const pendingCount = (target: Feature) =>
    items.filter((item) => item.feature === target && item.status === "PENDING_REVIEW").length;

  const review = async (item: ReviewItem, status: ReviewStatus) => {
    setActingId(item.id);
    setError("");
    setSuccess("");
    try {
      const endpoint = item.feature === "mading"
        ? `/api/student-board/posts/${item.id}`
        : `/api/student-spotlight/submissions/${item.id}`;
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: notes[item.id]?.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan hasil review");
      const updated = item.feature === "mading" ? data.post : data.submission;
      setItems((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, ...updated, feature: item.feature } : entry
      ));
      setNotes((current) => ({ ...current, [item.id]: "" }));
      setSuccess(`${item.title} berhasil diubah menjadi ${labels[status].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan hasil review.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-7">
          <div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Moderasi Sekolah</Badge>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Moderasi Konten Siswa</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review Mading sebelum terbit dan tangani Zona Kreasi yang dilaporkan pengguna.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Segarkan
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <FeatureButton active={feature === "mading"} icon={Newspaper} label="Mading Siswa" count={pendingCount("mading")} onClick={() => setFeature("mading")} />
        <FeatureButton active={feature === "spotlight"} icon={Clapperboard} label="Laporan Zona Kreasi" count={0} subtitle="Moderasi setelah dilaporkan" onClick={() => setFeature("spotlight")} />
      </div>

      {feature === "spotlight" ? (
        <StudentSpotlightReportsPanel />
      ) : (
        <>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{success}</div> : null}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : pending.length === 0 ? (
        <Card className="rounded-[24px] border-emerald-100"><CardContent className="flex flex-col items-center py-14 text-center">
          <CheckCircle2 className="mb-3 h-11 w-11 text-emerald-500" />
          <h2 className="font-black text-slate-950">Antrean review sudah bersih</h2>
          <p className="mt-2 text-sm text-slate-500">Belum ada kiriman {feature === "mading" ? "mading" : "Zona Kreasi"} baru.</p>
        </CardContent></Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-black text-slate-950">Menunggu Review</h2><Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">{pending.length} kiriman</Badge></div>
          {pending.map((item) => <ReviewCard key={`${item.feature}-${item.id}`} item={item} note={notes[item.id] || ""} acting={actingId === item.id} onNote={(value) => setNotes((current) => ({ ...current, [item.id]: value }))} onReview={review} />)}
        </section>
      )}

      {!loading && history.length > 0 ? (
        <section className="space-y-3"><h2 className="font-black text-slate-950">Riwayat Terbaru</h2>
          {history.map((item) => <Card key={`${item.feature}-${item.id}`} className="rounded-[22px] border-slate-100"><CardContent className="p-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{labels[item.status]}</Badge><Badge variant="secondary">{item.classRoom.name}</Badge></div><h3 className="mt-3 font-black">{item.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.content}</p></CardContent></Card>)}
        </section>
      ) : null}
        </>
      )}
    </div>
  );
}

function FeatureButton({ active, icon: Icon, label, count, subtitle, onClick }: { active: boolean; icon: typeof Newspaper; label: string; count: number; subtitle?: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${active ? "border-blue-300 bg-emerald-600 text-white shadow-lg shadow-blue-200" : "border-emerald-100 bg-white text-slate-800 hover:border-emerald-200"}`}><span className={`grid h-11 w-11 place-items-center rounded-xl ${active ? "bg-white/15" : "bg-emerald-50 text-emerald-600"}`}><Icon className="h-5 w-5" /></span><span className="flex-1"><span className="block font-black">{label}</span><span className={`text-xs font-semibold ${active ? "text-emerald-100" : "text-slate-500"}`}>{subtitle || `${count} menunggu review`}</span></span></button>;
}

function ReviewCard({ item, note, acting, onNote, onReview }: { item: ReviewItem; note: string; acting: boolean; onNote: (value: string) => void; onReview: (item: ReviewItem, status: ReviewStatus) => void }) {
  return <Card className="rounded-[24px] border-amber-100 bg-white shadow-[0_16px_40px_rgba(180,83,9,0.07)]"><CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_340px]">
    <div><div className="flex flex-wrap gap-2"><Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50"><Clock3 className="mr-1 h-3.5 w-3.5" />Menunggu review</Badge><Badge variant="secondary">{item.classRoom.name}</Badge></div><h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{item.content}</p><p className="mt-3 text-xs font-semibold text-slate-500">Pengirim: {item.student?.name || item.author?.name || "Siswa"} · {new Date(item.createdAt).toLocaleDateString("id-ID")}</p></div>
    <div className="space-y-3"><Textarea rows={3} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Catatan untuk siswa (wajib untuk revisi/penolakan)" /><div className="grid grid-cols-3 gap-2"><Button size="sm" disabled={acting} onClick={() => onReview(item, "PUBLISHED")}><CheckCircle2 className="mr-1 h-4 w-4" />Setujui</Button><Button size="sm" variant="outline" disabled={acting} onClick={() => onReview(item, "REVISION_REQUESTED")}><PenLine className="mr-1 h-4 w-4" />Revisi</Button><Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={acting} onClick={() => onReview(item, "REJECTED")}><XCircle className="mr-1 h-4 w-4" />Tolak</Button></div></div>
  </CardContent></Card>;
}
