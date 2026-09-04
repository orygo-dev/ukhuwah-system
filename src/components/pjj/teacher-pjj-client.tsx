"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Plus,
  RadioTower,
  RotateCcw,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
  PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
} from "@/lib/pjj-capacity";

type LiveSession = {
  id: string;
  title: string;
  subject: string;
  description?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  roomMode?: "MEETING" | "CLASSROOM";
  maxParticipants?: number;
  participants: Array<{ attendanceStatus: string; totalSeconds: number }>;
  _count: { participants: number };
};

type PjjStudent = {
  id: string;
  name: string;
  nis?: string | null;
  pjjEnrollments: Array<{
    id: string;
    status: string;
    programId: string;
    accessBarrier?: string | null;
  }>;
};

type PjjClass = {
  id: string;
  name: string;
  jenjang: string;
  school?: { name: string } | null;
  pjjProgram?: { name: string; status: string } | null;
  teacherAssignments: Array<{ subject: string; role: string }>;
  students?: PjjStudent[];
  liveClassSessions: LiveSession[];
};

type Intervention = {
  id: string;
  category: string;
  note: string;
  followUpAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  student: { id: string; name: string; nis?: string | null; classRoomId: string };
  createdBy: { id: string; name: string };
};

async function readJsonResponse(res: Response) {
  const text = await res.text();
  let data: { error?: string; [key: string]: unknown } | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string; [key: string]: unknown };
    } catch {
      throw new Error(
        res.ok
          ? "Respons server tidak valid (bukan JSON)."
          : `Gagal memuat data (HTTP ${res.status}).`
      );
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `Gagal memuat data (HTTP ${res.status}).`);
  }
  if (!data) {
    throw new Error("Respons server kosong.");
  }
  return data;
}

type ScheduleParts = {
  date: string;
  startTime: string;
  durationMinutes: number;
};

const DURATION_OPTIONS = [
  { value: 45, label: "45 menit" },
  { value: 60, label: "60 menit" },
  { value: 90, label: "90 menit" },
  { value: 120, label: "120 menit" },
] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roundUpToQuarter(date: Date) {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  if (rounded === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(rounded, 0, 0);
  }
  return next;
}

function defaultScheduleParts(): ScheduleParts {
  const start = roundUpToQuarter(new Date(Date.now() + 60 * 60 * 1000));
  return {
    date: toLocalDate(start),
    startTime: toLocalTime(start),
    durationMinutes: 90,
  };
}

function partsToStartDate(parts: ScheduleParts) {
  return new Date(`${parts.date}T${parts.startTime}:00`);
}

function partsToRange(parts: ScheduleParts) {
  const start = partsToStartDate(parts);
  const end = new Date(start.getTime() + parts.durationMinutes * 60 * 1000);
  return { start, end };
}

function isoToParts(value: string): ScheduleParts {
  const start = new Date(value);
  return {
    date: toLocalDate(start),
    startTime: toLocalTime(start),
    durationMinutes: 90,
  };
}

function durationBetween(startIso: string, endIso: string) {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
  );
  if (DURATION_OPTIONS.some((item) => item.value === minutes)) return minutes;
  return Math.max(15, minutes || 90);
}

function formatPartsPreview(parts: ScheduleParts) {
  const { start, end } = partsToRange(parts);
  if (Number.isNaN(start.getTime())) return "Tanggal/jam belum valid";
  return `${start.toLocaleString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })} – ${end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
}

function ScheduleFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: ScheduleParts;
  onChange: (next: ScheduleParts) => void;
}) {
  function setToday() {
    const now = new Date();
    onChange({
      ...value,
      date: toLocalDate(now),
      startTime: toLocalTime(roundUpToQuarter(now)),
    });
  }

  function setTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onChange({
      ...value,
      date: toLocalDate(tomorrow),
      startTime: value.startTime || "08:00",
    });
  }

  function bumpHour(delta: number) {
    const start = partsToStartDate(value);
    if (Number.isNaN(start.getTime())) return;
    start.setHours(start.getHours() + delta);
    onChange({
      ...value,
      date: toLocalDate(start),
      startTime: toLocalTime(start),
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={setToday}>
          Hari ini
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={setTomorrow}>
          Besok
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => bumpHour(1)}>
          +1 jam
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => bumpHour(-1)}>
          −1 jam
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-date`}>Tanggal</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-time`}>Jam mulai</Label>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            step={300}
            value={value.startTime}
            onChange={(event) => onChange({ ...value, startTime: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-duration`}>Durasi</Label>
          <select
            id={`${idPrefix}-duration`}
            value={value.durationMinutes}
            onChange={(event) =>
              onChange({ ...value, durationMinutes: Number(event.target.value) })
            }
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!DURATION_OPTIONS.some((item) => item.value === value.durationMinutes) ? (
              <option value={value.durationMinutes}>{value.durationMinutes} menit</option>
            ) : null}
          </select>
        </div>
      </div>
      <p className="text-xs font-semibold text-slate-600">
        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
        {formatPartsPreview(value)}
      </p>
    </div>
  );
}

export function TeacherPjjClient() {
  const router = useRouter();
  const defaults = useMemo(defaultScheduleParts, []);
  const [classes, setClasses] = useState<PjjClass[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformMaxParticipants, setPlatformMaxParticipants] = useState(
    PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
  );
  const [meetingMaxParticipants, setMeetingMaxParticipants] = useState(
    PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
  );
  const [classroomMaxParticipants, setClassroomMaxParticipants] = useState(
    PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scheduleParts, setScheduleParts] = useState<ScheduleParts>(defaults);
  const [rescheduleParts, setRescheduleParts] = useState<ScheduleParts>(defaults);
  const [rescheduleForm, setRescheduleForm] = useState({
    title: "",
    subject: "",
  });
  const [form, setForm] = useState({
    classRoomId: "",
    title: "Pertemuan PJJ",
    subject: "",
    description: "",
    roomMode: "MEETING" as "MEETING" | "CLASSROOM",
    maxParticipants: PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
    minAttendancePercent: 70,
  });
  const [interventionForm, setInterventionForm] = useState({
    classRoomId: "",
    studentId: "",
    category: "Kehadiran",
    note: "",
    followUpAt: "",
  });

  async function load() {
    try {
      const [sessionsRes, interventionsRes] = await Promise.all([
        fetch("/api/pjj/sessions"),
        fetch("/api/pjj/interventions?openOnly=1"),
      ]);
      const sessionsData = await readJsonResponse(sessionsRes);
      const classes = (sessionsData.classes || []) as PjjClass[];
      setClasses(classes);
      const liveKit = (sessionsData.liveKit || {}) as {
        meetingMaxParticipants?: number;
        maxParticipants?: number;
        classroomMaxParticipants?: number;
      };
      const meetingMaximum = Math.min(
        Number(
          liveKit.meetingMaxParticipants ||
            liveKit.maxParticipants ||
            PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
        ),
        PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
      );
      const classroomMaximum = Math.min(
        Number(
          liveKit.classroomMaxParticipants ||
            PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
        ),
        PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
      );
      setMeetingMaxParticipants(meetingMaximum);
      setClassroomMaxParticipants(classroomMaximum);
      setPlatformMaxParticipants(meetingMaximum);
      setForm((current) => {
        const modeMax =
          current.roomMode === "CLASSROOM" ? classroomMaximum : meetingMaximum;
        return {
          ...current,
          maxParticipants: Math.min(current.maxParticipants, modeMax),
        };
      });
      const first = classes[0];
      setForm((current) => ({
        ...current,
        classRoomId: current.classRoomId || first?.id || "",
        subject: current.subject || first?.teacherAssignments[0]?.subject || "",
      }));
      setInterventionForm((current) => ({
        ...current,
        classRoomId: current.classRoomId || first?.id || "",
        studentId: current.studentId || first?.students?.[0]?.id || "",
      }));

      if (interventionsRes.ok) {
        try {
          const interventionsData = await readJsonResponse(interventionsRes);
          setInterventions(
            (interventionsData.interventions || []) as Intervention[],
          );
        } catch {
          // Interventions are secondary; keep sessions UI usable.
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const interventionStudents =
    classes.find((room) => room.id === interventionForm.classRoomId)?.students || [];

  async function createSession(parts: ScheduleParts, options?: { redirectToRoom?: boolean }) {
    const { start, end } = partsToRange(parts);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Tanggal atau jam tidak valid.");
    }
    if (end <= start) {
      throw new Error("Waktu selesai harus setelah waktu mulai.");
    }

    const response = await fetch("/api/pjj/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        scheduledStart: start.toISOString(),
        scheduledEnd: end.toISOString(),
      }),
    });
    const data = await readJsonResponse(response);
    const createdSession = data.session as { id?: string } | undefined;

    if (options?.redirectToRoom && createdSession?.id) {
      setMessage("Sesi dimulai. Membuka ruang kelas...");
      router.push(`/pjj/room/${createdSession.id}`);
      return;
    }

    setMessage(
      options?.redirectToRoom === false && start.getTime() <= Date.now() + 60_000
        ? "Sesi dibuat untuk dimulai sekarang. Klik Masuk Kelas di daftar sesi."
        : "Sesi PJJ berhasil dijadwalkan."
    );
    await load();
  }

  async function schedule() {
    setBusy(true);
    setMessage(null);
    try {
      await createSession(scheduleParts);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menjadwalkan kelas.");
    } finally {
      setBusy(false);
    }
  }

  async function startNow() {
    setBusy(true);
    setMessage(null);
    try {
      const now = new Date();
      const parts: ScheduleParts = {
        date: toLocalDate(now),
        startTime: toLocalTime(now),
        durationMinutes: scheduleParts.durationMinutes || 90,
      };
      setScheduleParts(parts);
      await createSession(parts, { redirectToRoom: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memulai kelas sekarang.");
      setBusy(false);
    }
  }

  async function cancelSession(sessionId: string) {
    if (!window.confirm("Batalkan sesi PJJ ini? Siswa tidak akan bisa bergabung.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pjj/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await readJsonResponse(response);
      setMessage("Sesi PJJ dibatalkan.");
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membatalkan sesi.");
    } finally {
      setBusy(false);
    }
  }

  async function rescheduleSession(sessionId: string) {
    setBusy(true);
    setMessage(null);
    try {
      const { start, end } = partsToRange(rescheduleParts);
      if (Number.isNaN(start.getTime()) || end <= start) {
        throw new Error("Tanggal/jam jadwal ulang tidak valid.");
      }
      const response = await fetch(`/api/pjj/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          title: rescheduleForm.title,
          subject: rescheduleForm.subject,
          scheduledStart: start.toISOString(),
          scheduledEnd: end.toISOString(),
        }),
      });
      await readJsonResponse(response);
      setMessage("Sesi PJJ berhasil dijadwal ulang.");
      setEditingId(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menjadwal ulang sesi.");
    } finally {
      setBusy(false);
    }
  }

  async function createIntervention() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/pjj/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: interventionForm.studentId,
          category: interventionForm.category,
          note: interventionForm.note,
          followUpAt: interventionForm.followUpAt
            ? new Date(interventionForm.followUpAt).toISOString()
            : null,
        }),
      });
      await readJsonResponse(response);
      setMessage("Catatan pendampingan berhasil disimpan.");
      setInterventionForm((current) => ({ ...current, note: "", followUpAt: "" }));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuat intervensi.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveIntervention(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/pjj/interventions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: true }),
      });
      await readJsonResponse(response);
      setMessage("Intervensi ditandai selesai.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyelesaikan intervensi.");
    } finally {
      setBusy(false);
    }
  }

  const sessions = classes
    .flatMap((room) =>
      room.liveClassSessions.map((session) => ({ ...session, className: room.name }))
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()
    );

  const canSchedule =
    Boolean(form.classRoomId && form.subject && scheduleParts.date && scheduleParts.startTime) &&
    !Number.isNaN(partsToStartDate(scheduleParts).getTime());

  return (
    <DashboardShell activePath="/dashboard/pjj">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 shadow-sm lg:p-8">
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
            <RadioTower className="mr-1 h-3.5 w-3.5" />
            Ruang Mengajar PJJ
          </Badge>
          <h1 className="mt-4 text-3xl font-black">Kelas langsung</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Jadwalkan pembelajaran, mulai sekarang bila siap, masuk sebagai moderator, dan pantau
            durasi kehadiran siswa.
          </p>
        </section>

        {message ? (
          <div
            role="status"
            className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-800"
          >
            {message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <Card className="rounded-[24px] border-emerald-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="h-5 w-5 text-emerald-700" />
                Jadwalkan sesi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {classes.length === 0 && !loading ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Anda belum ditugaskan pada kelas PJJ.
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="teacherPjjClass">Kelas</Label>
                <select
                  id="teacherPjjClass"
                  value={form.classRoomId}
                  onChange={(event) => {
                    const room = classes.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      classRoomId: event.target.value,
                      subject: room?.teacherAssignments[0]?.subject || current.subject,
                    }));
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Pilih kelas</option>
                  {classes.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="liveTitle">Judul pertemuan</Label>
                <Input
                  id="liveTitle"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="liveSubject">Mata pelajaran</Label>
                <Input
                  id="liveSubject"
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Waktu pertemuan</Label>
                <ScheduleFields
                  idPrefix="schedule"
                  value={scheduleParts}
                  onChange={setScheduleParts}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="roomMode">Mode ruang</Label>
                  <select
                    id="roomMode"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.roomMode}
                    onChange={(event) => {
                      const roomMode = event.target.value as "MEETING" | "CLASSROOM";
                      const modeMax =
                        roomMode === "CLASSROOM"
                          ? classroomMaxParticipants
                          : meetingMaxParticipants;
                      setPlatformMaxParticipants(modeMax);
                      setForm((current) => ({
                        ...current,
                        roomMode,
                        maxParticipants: modeMax,
                      }));
                    }}
                  >
                    <option value="MEETING">
                      Meeting (hingga {meetingMaxParticipants}, semua bisa kamera)
                    </option>
                    <option value="CLASSROOM">
                      Classroom (hingga {classroomMaxParticipants}, siswa spectator)
                    </option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    {form.roomMode === "CLASSROOM"
                      ? "Siswa default tanpa kamera/mic; guru bisa promote ke strip."
                      : "Semua peserta dapat publish kamera dan mikrofon."}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity">Kapasitas</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min={2}
                    max={platformMaxParticipants}
                    value={form.maxParticipants}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxParticipants: Number(event.target.value),
                      }))
                    }
                  />
                  <p className="text-[11px] text-slate-500">
                    Batas mode {form.roomMode}: {platformMaxParticipants} peserta.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="attendanceMin">Minimal hadir (%)</Label>
                  <Input
                    id="attendanceMin"
                    type="number"
                    min={1}
                    max={100}
                    value={form.minAttendancePercent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        minAttendancePercent: Number(event.target.value),
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || !canSchedule} onClick={() => void schedule()}>
                  <CalendarClock className="h-4 w-4" />
                  {busy ? "Menyimpan..." : "Jadwalkan"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || !canSchedule}
                  onClick={() => void startNow()}
                >
                  <Zap className="h-4 w-4" />
                  Mulai sekarang
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Mulai sekarang membuat sesi dengan waktu saat ini lalu membuka ruang kelas.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-emerald-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Video className="h-5 w-5 text-emerald-700" />
                Riwayat sesi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-slate-500">Memuat sesi...</p>
              ) : sessions.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                  Belum ada sesi terjadwal.
                </p>
              ) : (
                sessions.map((session) => {
                  const present = session.participants.filter((item) =>
                    ["PRESENT", "LATE"].includes(item.attendanceStatus)
                  ).length;
                  const canManage = !["ENDED", "CANCELLED"].includes(session.status);
                  const isEditing = editingId === session.id;
                  return (
                    <div key={session.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-black text-slate-950">{session.title}</p>
                            <Badge variant="outline">{session.status}</Badge>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {session.className} · {session.subject}
                          </p>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
                            <Clock3 className="h-3.5 w-3.5" />
                            {new Date(session.scheduledStart).toLocaleString("id-ID")} –{" "}
                            {new Date(session.scheduledEnd).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <Users className="h-3.5 w-3.5" />
                            {present} hadir · {session._count.participants} tercatat
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex flex-wrap gap-2">
                            <Button asChild>
                              <Link href={`/pjj/room/${session.id}`}>
                                <Video className="h-4 w-4" />
                                Masuk Kelas
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                setEditingId(session.id);
                                setRescheduleForm({
                                  title: session.title,
                                  subject: session.subject,
                                });
                                setRescheduleParts({
                                  ...isoToParts(session.scheduledStart),
                                  durationMinutes: durationBetween(
                                    session.scheduledStart,
                                    session.scheduledEnd
                                  ),
                                });
                              }}
                            >
                              <RotateCcw className="h-4 w-4" />
                              Ubah Jadwal
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              disabled={busy}
                              onClick={() => void cancelSession(session.id)}
                            >
                              <X className="h-4 w-4" />
                              Batalkan
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {isEditing ? (
                        <div className="mt-4 space-y-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1 sm:col-span-2">
                              <Label>Judul</Label>
                              <Input
                                value={rescheduleForm.title}
                                onChange={(event) =>
                                  setRescheduleForm((current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-1 sm:col-span-2">
                              <Label>Mapel</Label>
                              <Input
                                value={rescheduleForm.subject}
                                onChange={(event) =>
                                  setRescheduleForm((current) => ({
                                    ...current,
                                    subject: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <ScheduleFields
                            idPrefix={`reschedule-${session.id}`}
                            value={rescheduleParts}
                            onChange={setRescheduleParts}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              disabled={busy}
                              onClick={() => void rescheduleSession(session.id)}
                            >
                              Simpan Jadwal Baru
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => setEditingId(null)}
                            >
                              Tutup
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[24px] border-emerald-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HeartHandshake className="h-5 w-5 text-emerald-700" />
              Pendampingan / Intervensi
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="interventionClass">Kelas</Label>
                <select
                  id="interventionClass"
                  value={interventionForm.classRoomId}
                  onChange={(event) => {
                    const room = classes.find((item) => item.id === event.target.value);
                    setInterventionForm((current) => ({
                      ...current,
                      classRoomId: event.target.value,
                      studentId: room?.students?.[0]?.id || "",
                    }));
                  }}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Pilih kelas</option>
                  {classes.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interventionStudent">Siswa</Label>
                <select
                  id="interventionStudent"
                  value={interventionForm.studentId}
                  onChange={(event) =>
                    setInterventionForm((current) => ({
                      ...current,
                      studentId: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Pilih siswa</option>
                  {interventionStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                      {student.nis ? ` · ${student.nis}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interventionCategory">Kategori</Label>
                <Input
                  id="interventionCategory"
                  value={interventionForm.category}
                  onChange={(event) =>
                    setInterventionForm((current) => ({
                      ...current,
                      category: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interventionNote">Catatan</Label>
                <Textarea
                  id="interventionNote"
                  rows={4}
                  value={interventionForm.note}
                  onChange={(event) =>
                    setInterventionForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interventionFollowUp">Tindak lanjut (opsional)</Label>
                <Input
                  id="interventionFollowUp"
                  type="datetime-local"
                  value={interventionForm.followUpAt}
                  onChange={(event) =>
                    setInterventionForm((current) => ({
                      ...current,
                      followUpAt: event.target.value,
                    }))
                  }
                />
              </div>
              <Button
                disabled={
                  busy ||
                  !interventionForm.studentId ||
                  interventionForm.category.trim().length < 2 ||
                  interventionForm.note.trim().length < 3
                }
                onClick={() => void createIntervention()}
              >
                <HeartHandshake className="h-4 w-4" />
                Simpan Intervensi
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-700">Intervensi terbuka</p>
              {loading ? (
                <p className="text-sm text-slate-500">Memuat...</p>
              ) : interventions.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-slate-500">
                  Belum ada intervensi terbuka.
                </p>
              ) : (
                interventions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-950">{item.student.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {item.category}
                          {item.followUpAt
                            ? ` · tindak lanjut ${new Date(item.followUpAt).toLocaleString("id-ID")}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void resolveIntervention(item.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Selesaikan
                      </Button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      oleh {item.createdBy.name} ·{" "}
                      {new Date(item.createdAt).toLocaleString("id-ID")}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
