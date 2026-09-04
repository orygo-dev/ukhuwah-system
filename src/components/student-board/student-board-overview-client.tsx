"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  Newspaper,
  PenLine,
  Plus,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardUser } from "@/hooks/use-dashboard-user";
import { formatDateId } from "@/lib/attendance";
import {
  STUDENT_BOARD_REPORT_LABELS,
  type StudentBoardReportReason,
} from "@/lib/student-board-reports";

type ClassRoom = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  _count: { students: number; sessions: number };
};

type BoardStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "REVISION_REQUESTED"
  | "REJECTED"
  | "ARCHIVED";

type BoardPost = {
  id: string;
  title: string;
  category: string;
  content: string;
  imageUrl: string | null;
  visibility: "CLASS" | "SCHOOL" | "GLOBAL";
  status: BoardStatus;
  reviewNote: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  classRoom: { id: string; name: string; jenjang: string; tahunAjaran: string };
  author: { id: string; name: string | null } | null;
  student: { id: string; name: string } | null;
  reviewer: { id: string; name: string | null } | null;
  reports: Array<{
    id: string;
    reason: string;
    details: string | null;
    createdAt: string;
    reporter: { id: string; name: string | null };
  }>;
};

const categories = [
  "Pengumuman",
  "Karya Siswa",
  "Prestasi",
  "Literasi",
  "Kegiatan Kelas",
  "Info Sekolah",
];

const initialForm = {
  classRoomId: "",
  title: "",
  category: "Pengumuman",
  content: "",
  imageUrl: "",
  visibility: "GLOBAL",
  status: "PUBLISHED",
};

const statusLabel: Record<BoardStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Menunggu review",
  PUBLISHED: "Terbit",
  REVISION_REQUESTED: "Perlu revisi",
  REJECTED: "Ditolak",
  ARCHIVED: "Arsip",
};

const statusClass: Record<BoardStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  PENDING_REVIEW: "bg-amber-50 text-amber-700 hover:bg-amber-50",
  PUBLISHED: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  REVISION_REQUESTED: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  REJECTED: "bg-red-50 text-red-700 hover:bg-red-50",
  ARCHIVED: "bg-slate-100 text-slate-500 hover:bg-slate-100",
};

function excerpt(text: string, max = 170) {
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

export function StudentBoardOverviewClient() {
  const dashboardUser = useDashboardUser();
  const searchParams = useSearchParams();
  const initialClassId = searchParams.get("classRoomId") || "";
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [showForm, setShowForm] = useState(false);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewVisibility, setReviewVisibility] = useState<
    Record<string, "CLASS" | "SCHOOL" | "GLOBAL">
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);

  const visiblePosts = useMemo(
    () =>
      selectedClassId
        ? posts.filter((post) => post.classRoom.id === selectedClassId)
        : posts,
    [posts, selectedClassId]
  );
  const pendingPosts = visiblePosts.filter((post) => post.status === "PENDING_REVIEW");
  const publishedPosts = visiblePosts.filter((post) => post.status === "PUBLISHED");
  const draftPosts = visiblePosts.filter((post) => post.status === "DRAFT");
  const studentSubmissions = posts.filter((post) => post.student).length;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [classRes, postRes] = await Promise.all([
        fetch("/api/attendance/classes"),
        fetch("/api/student-board/posts"),
      ]);
      const classData = await classRes.json();
      const postData = await postRes.json();
      if (!classRes.ok) throw new Error(classData.error || "Gagal memuat kelas");
      if (!postRes.ok) throw new Error(postData.error || "Gagal memuat mading");
      const loadedClasses = classData.classes || [];
      setClasses(loadedClasses);
      setPosts(postData.posts || []);
      if (initialClassId && loadedClasses.some((item: ClassRoom) => item.id === initialClassId)) {
        setForm((current) => ({ ...current, classRoomId: initialClassId }));
        setShowForm(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat mading.");
    } finally {
      setLoading(false);
    }
  }, [initialClassId]);

  useEffect(() => {
    load();
  }, [load]);

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/student-board/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat mading");
      setPosts((current) => [data.post, ...current]);
      setForm({ ...initialForm, classRoomId: initialClassId });
      setShowForm(false);
      setSuccess(
        form.status === "PUBLISHED"
          ? "Mading berhasil diterbitkan."
          : "Mading berhasil disimpan sebagai draft."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat mading");
    } finally {
      setSaving(false);
    }
  };

  const reviewPost = async (
    postId: string,
    status: BoardStatus,
    visibility?: "CLASS" | "SCHOOL" | "GLOBAL"
  ) => {
    setActingId(postId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/student-board/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNote: reviewNotes[postId] || undefined,
          ...(status === "PUBLISHED" ? { visibility: visibility || "GLOBAL" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mereview mading");
      setPosts((current) => current.map((post) => (post.id === postId ? data.post : post)));
      setReviewNotes((current) => ({ ...current, [postId]: "" }));
      setSuccess(`Mading berhasil diubah menjadi ${statusLabel[status].toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mereview mading");
    } finally {
      setActingId(null);
    }
  };

  return (
    <DashboardShell activePath="/dashboard/mading" user={dashboardUser}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_22px_60px_rgba(15,76,129,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 lg:p-7">
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                Mading Siswa
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                Kelola Mading Kelas & Karya Siswa
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Terbitkan informasi kelas, tampilkan karya siswa, dan review setiap
                kiriman sebelum tampil di portal siswa.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={() => setShowForm((value) => !value)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Mading
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedClassId("");
                    setShowForm(false);
                  }}
                >
                  Semua Kelas
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-blue-50 bg-emerald-50/60 p-5 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:p-6">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <Newspaper className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{posts.length}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Total mading</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <Clock3 className="mb-3 h-5 w-5 text-amber-600" />
                <p className="text-2xl font-black text-slate-950">{pendingPosts.length}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Perlu review</p>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <Eye className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-2xl font-black text-slate-950">{studentSubmissions}</p>
                <p className="text-xs font-bold uppercase text-slate-500">Karya siswa</p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {showForm ? (
          <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
            <CardContent className="p-5">
              <form onSubmit={createPost} className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-4">
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Kelas Tujuan</Label>
                    <Select
                      value={form.classRoomId}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, classRoomId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {item.tahunAjaran}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select
                      value={form.category}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PUBLISHED">Terbit langsung</SelectItem>
                        <SelectItem value="DRAFT">Simpan draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Judul Mading</Label>
                    <Input
                      value={form.title}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, title: event.target.value }))
                      }
                      placeholder="Contoh: Agenda literasi Jumat pagi"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Visibilitas</Label>
                    <Select
                      value={form.visibility}
                      onValueChange={(value) =>
                        setForm((current) => ({ ...current, visibility: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GLOBAL">Publik Navalogi</SelectItem>
                        <SelectItem value="CLASS">Kelas saja</SelectItem>
                        <SelectItem value="SCHOOL">Satu sekolah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>URL Gambar (opsional)</Label>
                    <Input
                      value={form.imageUrl}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, imageUrl: event.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-4">
                    <Label>Isi Mading</Label>
                    <Textarea
                      value={form.content}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, content: event.target.value }))
                      }
                      rows={7}
                      placeholder="Tulis isi pengumuman, karya, atau informasi yang akan tampil di portal siswa."
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving || classes.length === 0}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Simpan Mading
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Batal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.06)]">
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-extrabold text-slate-950">Filter Kelas</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedClassId("")}
                  className={`w-full rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${
                    selectedClassId === ""
                      ? "border-blue-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-200"
                  }`}
                >
                  Semua kelas
                </button>
                {classes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedClassId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      selectedClassId === item.id
                        ? "border-blue-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-100 bg-slate-50 text-slate-700 hover:border-emerald-200"
                    }`}
                  >
                    <span className="block text-sm font-extrabold">{item.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {item._count.students} siswa · {item.tahunAjaran}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : null}

            {!loading && pendingPosts.length > 0 ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-black text-slate-950">Menunggu Review</h2>
                  <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
                    {pendingPosts.length} kiriman
                  </Badge>
                </div>
                {pendingPosts.map((post) => (
                  <Card
                    key={post.id}
                    className="rounded-[24px] border-amber-100 bg-white shadow-[0_16px_40px_rgba(180,83,9,0.08)]"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusClass[post.status]}>
                              {statusLabel[post.status]}
                            </Badge>
                            <Badge variant="outline">{post.category}</Badge>
                            <Badge variant="secondary">{post.classRoom.name}</Badge>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-slate-950">
                            {post.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {excerpt(post.content, 260)}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Pengirim: {post.student?.name || post.author?.name || "Siswa"} ·{" "}
                            {formatDateId(post.createdAt)}
                          </p>
                        </div>
                        <div className="w-full space-y-3 xl:w-80">
                          <Textarea
                            value={reviewNotes[post.id] || ""}
                            onChange={(event) =>
                              setReviewNotes((current) => ({
                                ...current,
                                [post.id]: event.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Catatan review untuk siswa (opsional)"
                          />
                          <Select
                            value={reviewVisibility[post.id] || post.visibility}
                            onValueChange={(value: "CLASS" | "SCHOOL" | "GLOBAL") =>
                              setReviewVisibility((current) => ({
                                ...current,
                                [post.id]: value,
                              }))
                            }
                          >
                            <SelectTrigger aria-label="Lingkup publikasi">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CLASS">Terbit untuk kelas</SelectItem>
                              <SelectItem value="SCHOOL">Terbit untuk sekolah</SelectItem>
                              <SelectItem value="GLOBAL">Publik Navalogi — semua siswa</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              disabled={actingId === post.id}
                              onClick={() =>
                                reviewPost(
                                  post.id,
                                  "PUBLISHED",
                                  reviewVisibility[post.id] || post.visibility
                                )
                              }
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === post.id}
                              onClick={() => reviewPost(post.id, "REVISION_REQUESTED")}
                            >
                              <PenLine className="mr-1 h-4 w-4" />
                              Revisi
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === post.id}
                              onClick={() => reviewPost(post.id, "REJECTED")}
                              className="border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Tolak
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : null}

            {!loading && visiblePosts.length === 0 ? (
              <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.06)]">
                <CardContent className="flex flex-col items-center py-16 text-center">
                  <Newspaper className="mb-4 h-12 w-12 text-blue-300" />
                  <h3 className="font-extrabold text-slate-950">Belum ada mading</h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Buat informasi kelas atau tunggu kiriman karya siswa untuk direview.
                  </p>
                  <Button className="mt-5" onClick={() => setShowForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Buat Mading
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!loading && (publishedPosts.length > 0 || draftPosts.length > 0) ? (
              <section className="space-y-3">
                <h2 className="text-base font-black text-slate-950">Mading Aktif</h2>
                {[...publishedPosts, ...draftPosts].map((post) => (
                  <Card
                    key={post.id}
                    className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_40px_rgba(15,76,129,0.055)] transition hover:border-emerald-200 hover:shadow-[0_20px_50px_rgba(15,76,129,0.09)]"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={statusClass[post.status]}>
                              {statusLabel[post.status]}
                            </Badge>
                            <Badge variant="outline">{post.category}</Badge>
                            <Badge variant="secondary">{post.classRoom.name}</Badge>
                            <Badge variant="outline">
                              {post.visibility === "GLOBAL"
                                ? "Publik Navalogi"
                                : post.visibility === "SCHOOL"
                                  ? "Satu sekolah"
                                  : "Kelas"}
                            </Badge>
                          </div>
                          <h3 className="mt-3 text-lg font-black text-slate-950">
                            {post.title}
                          </h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                            {post.content}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Oleh {post.student?.name || post.author?.name || "Guru"} ·{" "}
                            {formatDateId(post.publishedAt || post.createdAt)}
                          </p>
                          {post.reports.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                              <p className="font-extrabold">
                                Dilaporkan {post.reports.length} pengguna
                              </p>
                              <p className="mt-1">
                                {post.reports[0]?.details ||
                                  STUDENT_BOARD_REPORT_LABELS[
                                    post.reports[0]?.reason as StudentBoardReportReason
                                  ] ||
                                  post.reports[0]?.reason}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {post.status !== "ARCHIVED" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actingId === post.id}
                            onClick={() => reviewPost(post.id, "ARCHIVED")}
                          >
                            Arsipkan
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
