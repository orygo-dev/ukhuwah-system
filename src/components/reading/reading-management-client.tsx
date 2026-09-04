"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CheckCircle2, FileImage, FileText, FileUp, Library, Link2, Loader2, Plus, Send, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { READING_CATEGORIES, readingStatusLabel } from "@/lib/reading-shared";
import { renderPdfPageAsCover } from "@/lib/reading-pdf-cover";
import { fetchReadingJson } from "@/lib/reading-request";
import {
  READING_PDF_CHUNK_BYTES,
  READING_PDF_MAX_MB,
  readingPdfChunkCount,
  readingPdfSizeError,
} from "@/lib/reading-upload-limits";

type ManagementRole = "TEACHER" | "SCHOOL_ADMIN" | "SUPER_ADMIN";
type BookRow = {
  id: string;
  title: string;
  authorName: string;
  description: string;
  category: string;
  contentType: "ARTICLE" | "PDF" | "EXTERNAL_LINK";
  scope: "GLOBAL" | "SCHOOL" | "CLASS";
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  reviewNote: string | null;
  createdById: string;
  createdBy: { name: string };
  school: { name: string } | null;
  classRoom: { name: string } | null;
  _count?: { progress: number; assignments: number };
};

type ClassOption = { id: string; name: string };
type CoverMode = "EBOOK_PAGE" | "UPLOAD" | "NONE";

function scopeLabel(scope: string) {
  if (scope === "GLOBAL") return "Global";
  if (scope === "SCHOOL") return "Sekolah";
  return "Kelas";
}

export function ReadingManagementClient({
  role,
  actorId,
  initialBooks,
  classes,
}: {
  role: ManagementRole;
  actorId: string;
  initialBooks: BookRow[];
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [books, setBooks] = useState(initialBooks);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssignment, setShowAssignment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const [message, setMessage] = useState("");
  const [contentType, setContentType] = useState<BookRow["contentType"]>(
    role === "SUPER_ADMIN" ? "PDF" : "ARTICLE",
  );
  const [coverMode, setCoverMode] = useState<CoverMode>(
    role === "SUPER_ADMIN" ? "EBOOK_PAGE" : "UPLOAD",
  );
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [coverPage, setCoverPage] = useState(1);
  const [renderedCoverPage, setRenderedCoverPage] = useState<number | null>(null);
  const [generatedCover, setGeneratedCover] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const coverRenderId = useRef(0);
  const publishedBooks = useMemo(() => books.filter((book) => book.status === "PUBLISHED"), [books]);
  const coverPageOptions = useMemo(
    () =>
      pdfPageCount && pdfPageCount <= 500
        ? Array.from({ length: pdfPageCount }, (_, index) => index + 1)
        : [],
    [pdfPageCount],
  );
  const stats = useMemo(
    () => ({
      total: books.length,
      published: publishedBooks.length,
      review: books.filter((book) => book.status === "PENDING_REVIEW").length,
      readers: books.reduce((sum, book) => sum + (book._count?.progress ?? 0), 0),
    }),
    [books, publishedBooks.length]
  );

  useEffect(() => {
    return () => {
      coverRenderId.current += 1;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  function showCoverPreview(file: File | null) {
    setCoverPreviewUrl(file ? URL.createObjectURL(file) : "");
  }

  async function generateCoverFromPdf(file: File, pageNumber: number) {
    const requestId = ++coverRenderId.current;
    setCoverBusy(true);
    setMessage("");
    try {
      const result = await renderPdfPageAsCover(file, pageNumber);
      if (requestId !== coverRenderId.current) return null;
      setPdfPageCount(result.pageCount);
      setCoverPage(result.pageNumber);
      setRenderedCoverPage(result.pageNumber);
      setGeneratedCover(result.file);
      showCoverPreview(result.file);
      return result;
    } catch (error) {
      if (requestId === coverRenderId.current) {
        setGeneratedCover(null);
        setRenderedCoverPage(null);
        showCoverPreview(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "Halaman ebook gagal dijadikan sampul.",
        );
      }
      return null;
    } finally {
      if (requestId === coverRenderId.current) setCoverBusy(false);
    }
  }

  async function handlePdfChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    coverRenderId.current += 1;
    setPdfFile(file);
    setPdfPageCount(null);
    setCoverPage(1);
    setRenderedCoverPage(null);
    setGeneratedCover(null);
    showCoverPreview(null);
    const sizeError = file ? readingPdfSizeError(file.size) : null;
    if (sizeError) {
      event.target.value = "";
      setPdfFile(null);
      setMessage(sizeError);
      return;
    }
    if (file && coverMode === "EBOOK_PAGE") await generateCoverFromPdf(file, 1);
  }

  function handleUploadedCover(event: React.ChangeEvent<HTMLInputElement>) {
    showCoverPreview(event.target.files?.[0] ?? null);
  }

  async function upload(file: File, kind: "cover" | "document") {
    if (kind === "document") {
      const sizeError = readingPdfSizeError(file.size);
      if (sizeError) throw new Error(sizeError);
    }
    if (kind === "document" && file.size > READING_PDF_CHUNK_BYTES) {
      const uploadId = crypto.randomUUID();
      const totalChunks = readingPdfChunkCount(file.size);
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const start = chunkIndex * READING_PDF_CHUNK_BYTES;
        const chunk = file.slice(start, Math.min(start + READING_PDF_CHUNK_BYTES, file.size));
        const form = new FormData();
        form.set("file", chunk, file.name);
        form.set("kind", kind);
        form.set("uploadId", uploadId);
        form.set("chunkIndex", String(chunkIndex));
        form.set("totalChunks", String(totalChunks));
        form.set("totalSize", String(file.size));
        setSaveStage(`Mengunggah file PDF... ${Math.round((chunkIndex / totalChunks) * 100)}%`);

        let data: { complete: boolean; url?: string } | null = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            data = await fetchReadingJson<{ complete: boolean; url?: string }>(
              "/api/reading/upload",
              { method: "POST", body: form },
              { timeoutMs: 110_000 },
            );
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await new Promise((resolve) => window.setTimeout(resolve, 1_500));
          }
        }
        if (data?.complete && data.url) return data.url;
      }
      throw new Error("Upload PDF selesai tetapi URL file tidak diterima.");
    }

    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);
    const data = await fetchReadingJson<{ url: string }>(
      "/api/reading/upload",
      { method: "POST", body: form },
      { timeoutMs: 90_000 },
    );
    return data.url;
  }

  async function createBook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaveStage("Menyiapkan bacaan...");
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const contentType = String(form.get("contentType"));
      const coverFile = form.get("coverFile");
      const documentFile = form.get("documentFile");
      let coverUrl = "";
      let contentUrl = String(form.get("contentUrl") || "");
      let detectedPageCount = pdfPageCount;
      if (contentType === "PDF" && coverMode === "EBOOK_PAGE") {
        const sourcePdf = pdfFile ?? (documentFile instanceof File && documentFile.size ? documentFile : null);
        if (!sourcePdf) throw new Error("Pilih file PDF untuk menggunakan halaman ebook sebagai sampul.");
        let cover = generatedCover;
        if (!cover || renderedCoverPage !== coverPage) {
          const result = await generateCoverFromPdf(sourcePdf, coverPage);
          if (!result) throw new Error("Halaman ebook gagal dijadikan sampul.");
          cover = result.file;
          detectedPageCount = result.pageCount;
        }
        setSaveStage("Mengunggah sampul...");
        coverUrl = await upload(cover, "cover");
      } else if (coverMode === "UPLOAD" && coverFile instanceof File && coverFile.size) {
        setSaveStage("Mengunggah sampul...");
        coverUrl = await upload(coverFile, "cover");
      }
      if (contentType === "PDF" && documentFile instanceof File && documentFile.size) {
        setSaveStage("Mengunggah file PDF...");
        contentUrl = await upload(documentFile, "document");
      }
      const payload = {
        title: String(form.get("title") || ""),
        authorName: String(form.get("authorName") || ""),
        description: String(form.get("description") || ""),
        category: String(form.get("category") || "Literasi"),
        targetLevel: String(form.get("targetLevel") || "SMA/SMK"),
        coverUrl,
        contentType,
        contentUrl,
        contentText: String(form.get("contentText") || ""),
        pageCount: detectedPageCount || Number(form.get("pageCount")) || 1,
        estimatedMinutes: Number(form.get("estimatedMinutes")) || 10,
        licenseName: String(form.get("licenseName") || ""),
        rightsHolder: String(form.get("rightsHolder") || ""),
        sourceUrl: String(form.get("sourceUrl") || ""),
        scope: String(form.get("scope") || (role === "SUPER_ADMIN" ? "GLOBAL" : "SCHOOL")),
        classRoomId: String(form.get("classRoomId") || "") || null,
        status: String(form.get("status") || "DRAFT"),
      };
      setSaveStage("Menyimpan data bacaan...");
      await fetchReadingJson<{ book: BookRow }>(
        "/api/reading/books",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        { timeoutMs: 30_000 },
      );
      setMessage("Bacaan berhasil disimpan");
      setShowCreate(false);
      setGeneratedCover(null);
      setPdfFile(null);
      showCoverPreview(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menambah bacaan");
    } finally {
      setBusy(false);
      setSaveStage("");
    }
  }

  async function updateStatus(book: BookRow, status: BookRow["status"]) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/reading/books/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memperbarui status");
      setBooks((current) => current.map((item) => (item.id === book.id ? { ...item, status: data.book.status } : item)));
      setMessage("Status bacaan berhasil diperbarui");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui status");
    } finally {
      setBusy(false);
    }
  }

  async function createAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const dueValue = String(form.get("dueAt") || "");
      const response = await fetch("/api/reading/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: String(form.get("bookId") || ""),
          classRoomId: String(form.get("classRoomId") || ""),
          title: String(form.get("title") || ""),
          instructions: String(form.get("instructions") || ""),
          dueAt: dueValue ? new Date(dueValue).toISOString() : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat tugas baca");
      setMessage("Tugas baca berhasil diterbitkan");
      setShowAssignment(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat tugas baca");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-sky-950 via-blue-900 to-cyan-700 p-6 text-white shadow-xl shadow-blue-950/10 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex rounded-2xl bg-white/12 p-3"><Library className="h-7 w-7" /></div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Perpustakaan Digital</p>
            <h1 className="mt-2 text-3xl font-black lg:text-4xl">Zona Baca</h1>
            <p className="mt-3 text-sm leading-6 text-emerald-100">Kelola koleksi yang legal, terarah, dan terukur. Aktivitas siswa menjadi data literasi sekolah dan dinas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {role !== "SUPER_ADMIN" && classes.length > 0 ? <Button type="button" variant="secondary" onClick={() => setShowAssignment((value) => !value)}><Send className="mr-2 h-4 w-4" />Buat Tugas Baca</Button> : null}
            <Button type="button" className="bg-white text-emerald-950 hover:bg-emerald-50" onClick={() => setShowCreate((value) => !value)}><Plus className="mr-2 h-4 w-4" />Tambah Bacaan</Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total koleksi", stats.total, Library],
          ["Sudah terbit", stats.published, CheckCircle2],
          ["Menunggu review", stats.review, ShieldCheck],
          ["Pembaca tercatat", stats.readers, BookOpen],
        ].map(([label, value, Icon]) => {
          const MetricIcon = Icon as typeof Library;
          return <Card key={String(label)} className="rounded-[24px]"><CardContent className="flex items-center gap-4 p-5"><div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700"><MetricIcon className="h-5 w-5" /></div><div><p className="text-2xl font-black">{String(value)}</p><p className="text-xs font-bold text-slate-500">{String(label)}</p></div></CardContent></Card>;
        })}
      </div>

      {message ? <p role="status" className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{message}</p> : null}

      {showCreate ? (
        <Card className="rounded-[28px]">
          <CardHeader className="pb-4">
            <CardTitle>Tambah Bacaan Global</CardTitle>
            <p className="text-sm text-slate-500">
              Isi informasi utama, pilih sumber bacaan, lalu tentukan sampul. Detail hak cipta dapat dilengkapi bila diperlukan.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={createBook} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Judul bacaan">
                  <Input name="title" required minLength={3} placeholder="Contoh: Mengenal Tata Surya" />
                </Field>
                <Field label="Penulis">
                  <Input name="authorName" required placeholder="Nama penulis atau instansi" />
                </Field>
                <Field label="Kategori">
                  <select name="category" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                    {READING_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </Field>
                <Field label="Jenjang sasaran">
                  <Input name="targetLevel" defaultValue="SMA/SMK" />
                </Field>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-slate-900">Format bacaan</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ["PDF", "Ebook PDF", FileText],
                    ["ARTICLE", "Tulis artikel", BookOpen],
                    ["EXTERNAL_LINK", "Tautan luar", Link2],
                  ] as const).map(([value, label, Icon]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${contentType === value ? "border-blue-500 bg-emerald-50 text-emerald-900" : "border-slate-200 hover:border-emerald-200"}`}>
                      <input
                        type="radio"
                        name="contentType"
                        value={value}
                        checked={contentType === value}
                        onChange={() => {
                          setContentType(value);
                          setCoverMode(value === "PDF" ? "EBOOK_PAGE" : "UPLOAD");
                          setGeneratedCover(null);
                          setRenderedCoverPage(null);
                          showCoverPreview(null);
                        }}
                        className="sr-only"
                      />
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-bold">{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {contentType === "PDF" ? (
                <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 md:grid-cols-2">
                  <Field label="File ebook PDF">
                    <Input name="documentFile" type="file" accept="application/pdf" onChange={(event) => void handlePdfChange(event)} />
                  </Field>
                  <Field label="Atau URL PDF">
                    <Input name="contentUrl" type="url" placeholder="https://.../ebook.pdf" />
                  </Field>
                  <p className="text-xs leading-5 text-slate-500 md:col-span-2">
                    PDF maksimal {READING_PDF_MAX_MB} MB. Unggah file untuk membuat sampul dari halaman ebook. Jika hanya memakai URL, pilih unggah gambar atau tanpa sampul.
                  </p>
                </div>
              ) : contentType === "EXTERNAL_LINK" ? (
                <Field label="Tautan bacaan">
                  <Input name="contentUrl" type="url" required placeholder="https://..." />
                </Field>
              ) : (
                <Field label="Isi artikel">
                  <Textarea name="contentText" required minLength={10} rows={10} placeholder="Tulis isi bacaan lengkap di sini..." />
                </Field>
              )}

              <Field label="Deskripsi singkat">
                <Textarea name="description" required minLength={10} rows={3} placeholder="Ringkasan yang akan dilihat siswa sebelum membaca." />
              </Field>

              <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">Pilihan sampul</legend>
                <div className="grid gap-2 text-sm font-semibold sm:flex sm:flex-wrap sm:gap-4">
                  {contentType === "PDF" ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="coverMode"
                        checked={coverMode === "EBOOK_PAGE"}
                        onChange={() => {
                          setCoverMode("EBOOK_PAGE");
                          if (pdfFile) void generateCoverFromPdf(pdfFile, coverPage);
                        }}
                      />
                      Gunakan halaman ebook
                    </label>
                  ) : null}
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="coverMode" checked={coverMode === "UPLOAD"} onChange={() => setCoverMode("UPLOAD")} />
                    Unggah gambar
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" name="coverMode" checked={coverMode === "NONE"} onChange={() => { setCoverMode("NONE"); showCoverPreview(null); }} />
                    Tanpa sampul
                  </label>
                </div>

                {coverMode === "EBOOK_PAGE" && contentType === "PDF" ? (
                  <div className="min-w-0 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-emerald-950">Pilih halaman ebook untuk sampul</p>
                      <p className="mt-1 text-xs leading-5 text-emerald-800">
                        {pdfPageCount
                          ? `PDF memiliki ${pdfPageCount} halaman. Pilih halaman yang ingin dijadikan sampul.`
                          : "Unggah file PDF pada bagian File ebook PDF. Pilihan nomor halaman akan muncul di sini."}
                      </p>
                    </div>
                    <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                      <Field label="Nomor halaman sampul">
                        {coverPageOptions.length > 0 ? (
                          <select
                            aria-label="Pilih nomor halaman sampul"
                            value={coverPage}
                            onChange={(event) => setCoverPage(Number(event.target.value))}
                            className="h-10 w-full rounded-md border bg-white px-3 text-sm"
                          >
                            {coverPageOptions.map((pageNumber) => (
                              <option key={pageNumber} value={pageNumber}>Halaman {pageNumber}</option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            aria-label="Pilih nomor halaman sampul"
                            type="number"
                            min={1}
                            max={pdfPageCount ?? undefined}
                            value={coverPage}
                            disabled={!pdfFile}
                            onChange={(event) => setCoverPage(Number(event.target.value) || 1)}
                          />
                        )}
                      </Field>
                      <Button className="h-auto min-h-10 w-full whitespace-normal md:w-auto" type="button" variant="outline" disabled={!pdfFile || coverBusy} onClick={() => pdfFile && void generateCoverFromPdf(pdfFile, coverPage)}>
                        {coverBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                        Gunakan halaman ini sebagai sampul
                      </Button>
                    </div>
                  </div>
                ) : coverMode === "UPLOAD" ? (
                  <Field label="Gambar sampul (JPG/PNG/WebP)">
                    <Input name="coverFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleUploadedCover} />
                  </Field>
                ) : null}

                {coverPreviewUrl ? (
                  <div className="flex items-start gap-4 rounded-2xl bg-slate-50 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverPreviewUrl} alt="Pratinjau sampul bacaan" className="h-40 w-28 rounded-lg border bg-white object-contain shadow-sm" />
                    <div className="pt-2 text-sm">
                      <p className="font-bold text-slate-900">Pratinjau sampul</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {renderedCoverPage ? `Diambil dari halaman ${renderedCoverPage} ebook.` : "Gambar yang dipilih akan digunakan sebagai sampul."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </fieldset>

              {role === "SUPER_ADMIN" ? <input type="hidden" name="scope" value="GLOBAL" /> : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Ruang publikasi">
                    <select name="scope" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={role === "SCHOOL_ADMIN" ? "SCHOOL" : "CLASS"}>
                      <option value="SCHOOL">Sekolah</option>
                      {role === "TEACHER" ? <option value="CLASS">Kelas</option> : null}
                    </select>
                  </Field>
                  {classes.length > 0 ? <Field label="Kelas"><select name="classRoomId" className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Pilih kelas bila diperlukan</option>{classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></Field> : null}
                </div>
              )}

              <details className="rounded-2xl border border-dashed border-slate-300 p-4">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">Detail tambahan (opsional)</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Estimasi baca (menit)"><Input name="estimatedMinutes" type="number" min={1} defaultValue={10} /></Field>
                  <Field label="Jumlah halaman"><Input name="pageCount" type="number" min={1} defaultValue={1} /></Field>
                  <Field label="Lisensi"><Input name="licenseName" placeholder="Contoh: CC BY 4.0 / Izin sekolah" /></Field>
                  <Field label="Pemegang hak"><Input name="rightsHolder" /></Field>
                  <div className="md:col-span-2"><Field label="Sumber resmi"><Input name="sourceUrl" type="url" placeholder="https://..." /></Field></div>
                </div>
              </details>

              <div className="flex flex-wrap items-end justify-between gap-3 border-t pt-5">
                <Field label="Status awal">
                  <select name="status" className="h-10 rounded-md border bg-background px-3 text-sm" defaultValue={role === "TEACHER" ? "DRAFT" : "PUBLISHED"}>
                    {role === "TEACHER" ? null : <option value="PUBLISHED">Terbitkan</option>}
                    <option value="DRAFT">Simpan draf</option>
                    {role === "TEACHER" ? <option value="PENDING_REVIEW">Ajukan review</option> : null}
                  </select>
                </Field>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Batal</Button>
                  <Button disabled={busy || coverBusy} type="submit">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                    {busy ? saveStage || "Menyimpan..." : "Simpan Bacaan"}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showAssignment ? (
        <Card className="rounded-[28px]"><CardHeader><CardTitle>Buat Tugas Baca</CardTitle></CardHeader><CardContent><form onSubmit={createAssignment} className="grid gap-4 md:grid-cols-2"><Field label="Bacaan"><select name="bookId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Pilih bacaan terbit</option>{publishedBooks.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></Field><Field label="Kelas"><select name="classRoomId" required className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Pilih kelas</option>{classes.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></Field><Field label="Judul tugas"><Input name="title" required /></Field><Field label="Tenggat"><Input name="dueAt" type="datetime-local" /></Field><div className="md:col-span-2"><Field label="Instruksi/refleksi"><Textarea name="instructions" rows={3} /></Field></div><div className="md:col-span-2"><Button disabled={busy} type="submit">Terbitkan Tugas Baca</Button></div></form></CardContent></Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {books.map((book) => {
          const owns = book.createdById === actorId;
          const canReview = role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN";
          return <Card key={book.id} className="rounded-[26px]"><CardContent className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge>{book.category}</Badge><Badge variant="secondary">{scopeLabel(book.scope)}</Badge><Badge variant={book.status === "PUBLISHED" ? "default" : "outline"}>{readingStatusLabel(book.status)}</Badge></div><h2 className="mt-3 text-lg font-black">{book.title}</h2><p className="mt-1 text-xs font-bold text-slate-500">{book.authorName} · oleh {book.createdBy.name}{book.classRoom ? ` · ${book.classRoom.name}` : ""}</p></div><div className="text-right text-xs font-bold text-slate-500"><p>{book._count?.progress ?? 0} pembaca</p><p>{book._count?.assignments ?? 0} tugas</p></div></div><p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{book.description}</p>{book.reviewNote ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Catatan: {book.reviewNote}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{book.status === "DRAFT" && owns ? <Button size="sm" disabled={busy} onClick={() => updateStatus(book, "PENDING_REVIEW")}>Ajukan Review</Button> : null}{book.status === "PENDING_REVIEW" && canReview ? <><Button size="sm" disabled={busy} onClick={() => updateStatus(book, "PUBLISHED")}>Terbitkan</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => updateStatus(book, "REJECTED")}>Tolak</Button></> : null}{book.status === "PUBLISHED" && (owns || canReview) ? <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus(book, "ARCHIVED")}>Arsipkan</Button> : null}</div></CardContent></Card>;
        })}
      </div>
      {books.length === 0 ? <Card className="rounded-[26px]"><CardContent className="p-12 text-center"><Library className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-4 font-bold text-slate-600">Belum ada koleksi pada ruang ini.</p></CardContent></Card> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
