"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, ExternalLink, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ReaderBook = {
  id: string;
  title: string;
  authorName: string;
  description: string;
  category: string;
  contentType: "ARTICLE" | "PDF" | "EXTERNAL_LINK";
  contentUrl: string | null;
  contentText: string | null;
  pageCount: number;
  estimatedMinutes: number;
  licenseName: string | null;
  rightsHolder: string | null;
  sourceUrl: string | null;
};

export function ReadingReaderClient({
  book,
  initialProgress,
  assignment,
}: {
  book: ReaderBook;
  initialProgress: number;
  assignment: { id: string; title: string; instructions: string | null; submittedReflection: string | null } | null;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const secondsRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => { secondsRef.current += 15; }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function saveProgress(next: number) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/reading/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, progressPercent: next, currentPage: Math.max(1, Math.ceil((next / 100) * book.pageCount)), secondsReadDelta: secondsRef.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan progres");
      secondsRef.current = 0;
      setProgress(data.progress.progressPercent);
      setMessage(next === 100 ? "Bacaan ditandai selesai" : "Progres berhasil disimpan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan progres");
    } finally {
      setSaving(false);
    }
  }

  async function submitReflection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignment) return;
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reading/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id, reflection: String(form.get("reflection") || "") }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirim refleksi");
      setMessage("Refleksi berhasil dikumpulkan");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengirim refleksi");
    } finally {
      setSaving(false);
    }
  }

  return <div className="space-y-6 pb-10"><div className="flex flex-wrap items-center justify-between gap-3"><Button asChild variant="outline"><Link href="/student/zona-baca"><ArrowLeft className="mr-2 h-4 w-4" />Kembali ke Zona Baca</Link></Button><div className="flex gap-2"><Badge>{book.category}</Badge><Badge variant="secondary"><Clock3 className="mr-1 h-3 w-3" />{book.estimatedMinutes} menit</Badge></div></div>
    <section className="rounded-[30px] bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 p-6 text-white lg:p-8"><BookOpen className="h-8 w-8 text-cyan-300" /><h1 className="mt-4 max-w-3xl text-3xl font-black lg:text-4xl">{book.title}</h1><p className="mt-2 font-bold text-blue-200">{book.authorName}</p><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-200">{book.description}</p><div className="mt-6"><div className="mb-2 flex justify-between text-xs font-bold"><span>Progres membaca</span><span>{progress}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} /></div></div></section>
    {message ? <p role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{message}</p> : null}
    <Card className="rounded-[28px]"><CardContent className="p-0">{book.contentType === "ARTICLE" ? <article className="prose prose-slate mx-auto max-w-3xl whitespace-pre-line px-6 py-8 text-[16px] leading-8 lg:px-10">{book.contentText}</article> : book.contentType === "PDF" && book.contentUrl ? <iframe title={`Pembaca ${book.title}`} src={book.contentUrl} className="h-[72vh] min-h-[620px] w-full rounded-[28px]" /> : book.contentUrl ? <div className="p-10 text-center"><ExternalLink className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="mt-4 text-xl font-black">Bacaan tersedia di sumber eksternal</h2><p className="mt-2 text-sm text-slate-500">Buka sumber resmi pada tab baru, kemudian kembali untuk menyimpan progres.</p><Button asChild className="mt-5"><a href={book.contentUrl} target="_blank" rel="noreferrer">Buka Bacaan <ExternalLink className="ml-2 h-4 w-4" /></a></Button></div> : <div className="p-10 text-center text-slate-500">Konten belum tersedia.</div>}</CardContent></Card>
    <Card className="rounded-[26px]"><CardHeader><CardTitle>Simpan Progres</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-2">{[25, 50, 75].map((value) => <Button key={value} type="button" variant={progress >= value ? "secondary" : "outline"} disabled={saving || progress >= value} onClick={() => saveProgress(value)}>{value}%</Button>)}<Button type="button" disabled={saving || progress === 100} onClick={() => saveProgress(100)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Tandai Selesai</Button></div><p className="mt-3 text-xs text-slate-500">Progres tidak dapat diturunkan agar statistik literasi tetap konsisten.</p></CardContent></Card>
    {assignment ? <Card className="rounded-[26px]"><CardHeader><CardTitle>{assignment.title}</CardTitle>{assignment.instructions ? <p className="text-sm leading-6 text-slate-600">{assignment.instructions}</p> : null}</CardHeader><CardContent><form onSubmit={submitReflection} className="space-y-3"><Textarea name="reflection" required minLength={20} rows={6} defaultValue={assignment.submittedReflection || ""} placeholder="Tuliskan gagasan utama, hal baru yang dipelajari, dan pendapatmu..." /><Button disabled={saving} type="submit"><Save className="mr-2 h-4 w-4" />Kumpulkan Refleksi</Button></form></CardContent></Card> : null}
    <Card className="rounded-[22px] border-dashed"><CardContent className="p-5 text-xs leading-5 text-slate-500"><p><strong>Hak penggunaan:</strong> {book.licenseName || "Belum dicantumkan"}</p><p><strong>Pemegang hak:</strong> {book.rightsHolder || "Belum dicantumkan"}</p>{book.sourceUrl ? <a href={book.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-emerald-700">Lihat sumber resmi</a> : null}</CardContent></Card>
  </div>;
}
