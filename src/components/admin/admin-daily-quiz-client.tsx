"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Loader2,
  Save,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DailyQuizSettings } from "@/lib/daily-quiz";

type QuizRow = {
  id: string;
  dateKey: string;
  title: string;
  theme: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  questionCount: number;
  generatedByAi: boolean;
  publishedAt: string | null;
  createdBy: { name: string } | null;
  _count: { attempts: number; questions: number };
};

type TodayQuiz = QuizRow & {
  description: string | null;
  questions: Array<{
    id: string;
    prompt: string;
    options: unknown;
    correctOptionIndex: number;
    explanation: string | null;
  }>;
};

export function AdminDailyQuizClient() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [todayKey, setTodayKey] = useState("");
  const [settings, setSettings] = useState<DailyQuizSettings>({
    questionCount: 5,
    themePool: [],
    level: "Campuran LOTS & HOTS",
  });
  const [themeText, setThemeText] = useState("");
  const [today, setToday] = useState<TodayQuiz | null>(null);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [generateTheme, setGenerateTheme] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/daily-quiz");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat");
      setTodayKey(data.todayKey);
      setSettings(data.settings);
      setThemeText((data.settings.themePool as string[]).join(", "));
      setToday(data.today);
      setQuizzes(data.quizzes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const themePool = themeText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/daily-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "settings",
          settings: {
            questionCount: settings.questionCount,
            themePool,
            level: settings.level,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setSettings(data.settings);
      setThemeText(data.settings.themePool.join(", "));
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const generateToday = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/daily-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          dateKey: todayKey,
          theme: generateTheme.trim() || undefined,
          publish: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal generate");
      setMessage(
        `${data.message}${data.providerName ? ` · AI: ${data.providerName}` : ""}`
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: "PUBLISHED" | "ARCHIVED" | "DRAFT") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/daily-quiz/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui");
      setMessage(data.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/daily-quiz">
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Memuat quiz harian...
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/daily-quiz">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Asesmen Nasional
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">
                Quiz Game Harian
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Satu quiz per hari untuk semua siswa Indonesia. Super Admin
                generate dengan AI yang sudah dikonfigurasi — guru tidak perlu
                membuat kuis kelas.
              </p>
            </div>
            <Badge className="bg-sky-50 text-sky-700 hover:bg-sky-50">
              <CalendarDays className="mr-1 h-3.5 w-3.5" />
              Hari ini · {todayKey}
            </Badge>
          </div>
        </section>

        {(error || message) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-[24px] border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="flex items-center gap-2 text-base font-extrabold">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Generate quiz hari ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Tema / mapel (opsional)</Label>
                <Input
                  value={generateTheme}
                  onChange={(e) => setGenerateTheme(e.target.value)}
                  placeholder="Kosongkan = tema rotasi otomatis"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {today ? (
                  <>
                    Quiz hari ini: <strong>{today.title}</strong> ·{" "}
                    {today._count.questions} soal · {today._count.attempts}{" "}
                    siswa main · status {today.status}
                  </>
                ) : (
                  "Belum ada quiz untuk hari ini. Generate agar semua siswa bisa bermain."
                )}
              </div>
              <Button
                onClick={() => void generateToday()}
                disabled={busy}
                className="rounded-2xl"
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate & publikasikan
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70">
              <CardTitle className="text-base font-extrabold">
                Pengaturan rutin
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Jumlah soal / hari</Label>
                <Input
                  type="number"
                  min={3}
                  max={15}
                  value={settings.questionCount}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      questionCount: Number(e.target.value) || 5,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Level</Label>
                <Input
                  value={settings.level}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, level: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pool tema (pisahkan koma)</Label>
                <Input
                  value={themeText}
                  onChange={(e) => setThemeText(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void saveSettings()}
                disabled={busy}
                className="rounded-2xl"
              >
                <Save className="mr-2 h-4 w-4" />
                Simpan pengaturan
              </Button>
            </CardContent>
          </Card>
        </div>

        {today?.questions?.length ? (
          <Card className="rounded-[24px] border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-extrabold">
                Pratinjau soal hari ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {today.questions.map((question, index) => (
                <div
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {index + 1}. {question.prompt}
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                    {(Array.isArray(question.options)
                      ? question.options
                      : []
                    ).map((option, optIndex) => (
                      <li
                        key={`${question.id}-${optIndex}`}
                        className={
                          optIndex === question.correctOptionIndex
                            ? "font-semibold text-emerald-700"
                            : undefined
                        }
                      >
                        {String(option)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-[24px] border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-extrabold">
              <Trophy className="h-4 w-4 text-amber-500" />
              Riwayat quiz nasional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{quiz.dateKey}</p>
                    <Badge variant="outline">{quiz.status}</Badge>
                    {quiz.generatedByAi ? (
                      <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">
                        AI
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {quiz.title} · {quiz.theme}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    {quiz._count.attempts} attempt · {quiz._count.questions} soal
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {quiz.status !== "PUBLISHED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={busy}
                      onClick={() => void setStatus(quiz.id, "PUBLISHED")}
                    >
                      Publikasikan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      disabled={busy}
                      onClick={() => void setStatus(quiz.id, "ARCHIVED")}
                    >
                      Arsipkan
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {quizzes.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada riwayat quiz.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
