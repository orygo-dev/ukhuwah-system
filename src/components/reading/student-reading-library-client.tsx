"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookMarked, BookOpen, CheckCircle2, Clock3, Heart, Library, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type StudentReadingBook = {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  description: string;
  category: string;
  contentType: "ARTICLE" | "PDF" | "EXTERNAL_LINK";
  coverUrl: string | null;
  estimatedMinutes: number;
  pageCount: number;
  scope: string;
  progressPercent: number;
  favorite: boolean;
};

type ReadingAssignmentRow = {
  id: string;
  title: string;
  dueAt: string | null;
  book: { id: string; slug: string; title: string };
  submitted: boolean;
};

export function StudentReadingLibraryClient({
  initialBooks,
  assignments,
}: {
  initialBooks: StudentReadingBook[];
  assignments: ReadingAssignmentRow[];
}) {
  const [books, setBooks] = useState(initialBooks);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const categories = useMemo(() => ["Semua", ...new Set(books.map((book) => book.category))], [books]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return books.filter((book) =>
      (category === "Semua" || book.category === category) &&
      (!needle || `${book.title} ${book.authorName} ${book.description}`.toLowerCase().includes(needle))
    );
  }, [books, category, query]);
  const completed = books.filter((book) => book.progressPercent === 100).length;
  const inProgress = books.filter((book) => book.progressPercent > 0 && book.progressPercent < 100).length;

  async function toggleFavorite(bookId: string) {
    const response = await fetch("/api/reading/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    if (!response.ok) return;
    const data = await response.json();
    setBooks((current) => current.map((book) => book.id === bookId ? { ...book, favorite: data.favorite } : book));
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-blue-950 via-indigo-900 to-cyan-700 p-6 text-white shadow-xl shadow-blue-950/10 lg:p-8">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-300/15 blur-2xl" />
        <div className="relative max-w-2xl">
          <div className="inline-flex rounded-2xl bg-white/12 p-3"><Library className="h-8 w-8" /></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Perpustakaan Digital Sekolah</p>
          <h1 className="mt-2 text-3xl font-black lg:text-4xl">Zona Baca</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-100">Temukan bacaan pilihan, lanjutkan progresmu, dan selesaikan tugas literasi dari guru.</p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={BookOpen} label="Koleksi tersedia" value={books.length} />
        <Metric icon={BookMarked} label="Sedang dibaca" value={inProgress} />
        <Metric icon={CheckCircle2} label="Selesai dibaca" value={completed} />
      </div>

      {assignments.length > 0 ? <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black">Tugas Baca</h2><Badge variant="secondary">{assignments.filter((item) => !item.submitted).length} perlu dikerjakan</Badge></div><div className="grid gap-3 md:grid-cols-2">{assignments.map((assignment) => <Link key={assignment.id} href={`/student/zona-baca/${assignment.book.slug}?assignment=${assignment.id}`}><Card className="h-full rounded-[22px] transition hover:border-blue-300 hover:shadow-md"><CardContent className="flex items-center gap-4 p-4"><div className="rounded-2xl bg-amber-50 p-3 text-amber-700"><BookMarked className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-black">{assignment.title}</p><p className="truncate text-xs font-semibold text-slate-500">{assignment.book.title}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{assignment.dueAt ? `Tenggat ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(assignment.dueAt))}` : "Tanpa tenggat"}</p></div><Badge variant={assignment.submitted ? "default" : "outline"}>{assignment.submitted ? "Terkumpul" : "Baca"}</Badge></CardContent></Card></Link>)}</div></section> : null}

      <section>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-xl font-black">Jelajahi Koleksi</h2><p className="text-sm text-slate-500">Koleksi global, sekolah, dan kelasmu.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Cari bacaan" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari judul atau penulis..." className="pl-9 sm:w-72" /></div><select aria-label="Filter kategori" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">{categories.map((item) => <option key={item}>{item}</option>)}</select></div></div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((book) => <article key={book.id} className="group overflow-hidden rounded-[26px] border bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"><div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-blue-100 via-indigo-100 to-cyan-50">{book.coverUrl ? <img src={book.coverUrl} alt={`Sampul ${book.title}`} className={`h-full w-full transition duration-300 group-hover:scale-105 ${book.contentType === "PDF" ? "bg-white object-contain" : "object-cover"}`} /> : <div className="grid h-full place-items-center"><BookOpen className="h-14 w-14 text-blue-300" /></div>}<button type="button" aria-label={book.favorite ? `Hapus ${book.title} dari favorit` : `Simpan ${book.title} ke favorit`} onClick={() => toggleFavorite(book.id)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-rose-500 shadow"><Heart className={`h-5 w-5 ${book.favorite ? "fill-current" : ""}`} /></button><Badge className="absolute left-3 top-3">{book.category}</Badge></div><div className="p-5"><div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500"><span><Clock3 className="mr-1 inline h-4 w-4" />{book.estimatedMinutes} menit</span><span>{book.pageCount} halaman</span></div><h3 className="mt-3 line-clamp-2 text-lg font-black">{book.title}</h3><p className="mt-1 text-xs font-bold text-slate-500">{book.authorName}</p><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{book.description}</p>{book.progressPercent > 0 ? <div className="mt-4"><div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500"><span>Progres</span><span>{book.progressPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${book.progressPercent}%` }} /></div></div> : null}<Button asChild className="mt-5 w-full"><Link href={`/student/zona-baca/${book.slug}`}>{book.progressPercent > 0 ? "Lanjutkan Membaca" : "Mulai Membaca"}</Link></Button></div></article>)}
        </div>
        {filtered.length === 0 ? <Card className="rounded-[26px]"><CardContent className="p-12 text-center"><Search className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-bold text-slate-600">Tidak ada bacaan yang cocok.</p></CardContent></Card> : null}
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return <Card className="rounded-[22px]"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-black">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div></CardContent></Card>;
}
