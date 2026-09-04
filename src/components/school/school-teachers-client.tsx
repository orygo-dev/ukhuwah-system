"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type TeacherProfile = {
  id: string;
  schoolName: string;
  jenjang: string;
  mapel: string;
  isPrimary: boolean;
};

type TeacherClass = {
  id: string;
  name: string;
  jenjang: string;
  tahunAjaran: string;
  teacherId: string;
  counts: {
    students: number;
    sessions: number;
    journals: number;
    assessments: number;
    assignments: number;
    quizzes: number;
    exams: number;
  };
};

type TeacherRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  profiles: TeacherProfile[];
  counts: {
    documents: number;
    dailyJournals: number;
    assessments: number;
    classes: number;
  };
};

type Props = {
  schoolName: string;
  region: string;
  teachers: TeacherRow[];
  classRooms: TeacherClass[];
  documentCount: number;
  journalCount: number;
  assessmentCount: number;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function SchoolTeachersClient({
  schoolName,
  region,
  teachers,
  classRooms,
  documentCount,
  journalCount,
  assessmentCount,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "with-class" | "without-class">("all");

  const classesByTeacher = useMemo(() => {
    const map = new Map<string, TeacherClass[]>();
    for (const classRoom of classRooms) {
      map.set(classRoom.teacherId, [...(map.get(classRoom.teacherId) || []), classRoom]);
    }
    return map;
  }, [classRooms]);

  const teacherStats = useMemo(
    () =>
      teachers.map((teacher) => {
        const rooms = classesByTeacher.get(teacher.id) || [];
        const students = rooms.reduce((sum, room) => sum + room.counts.students, 0);
        const sessions = rooms.reduce((sum, room) => sum + room.counts.sessions, 0);
        const learningActivities = rooms.reduce(
          (sum, room) =>
            sum +
            room.counts.journals +
            room.counts.assessments +
            room.counts.assignments +
            room.counts.quizzes +
            room.counts.exams,
          0
        );
        return { teacher, rooms, students, sessions, learningActivities };
      }),
    [classesByTeacher, teachers]
  );

  const filtered = teacherStats.filter(({ teacher, rooms }) => {
    const haystack = `${teacher.name} ${teacher.email} ${teacher.phone || ""} ${teacher.profiles
      .map((profile) => `${profile.mapel} ${profile.jenjang}`)
      .join(" ")}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "with-class" && rooms.length > 0) ||
      (filter === "without-class" && rooms.length === 0);
    return matchesQuery && matchesFilter;
  });

  const connectedWithClass = teacherStats.filter((item) => item.rooms.length > 0).length;
  const withoutClass = teacherStats.filter((item) => item.rooms.length === 0).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-emerald-100 bg-white shadow-[0_20px_65px_rgba(15,76,129,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 lg:p-8">
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              Guru Sekolah
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950">
              {schoolName}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Pantau guru yang terhubung ke sekolah, kelas yang dikelola, roster
              siswa, dan aktivitas pembelajaran. Guru pertama tetap bisa mulai
              memakai aplikasi sebelum admin sekolah hadir; panel ini mengambil alih
              monitoring ketika admin sekolah sudah aktif.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
              {region ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                  {region}
                </span>
              ) : null}
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                Guru-first, school-aware
              </span>
            </div>
          </div>
          <div className="grid gap-3 border-t border-blue-50 bg-emerald-50/60 p-5 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:p-6">
            <Metric label="Guru Terhubung" value={teachers.length} icon={GraduationCap} />
            <Metric label="Punya Kelas" value={connectedWithClass} icon={ShieldCheck} />
            <Metric label="Belum Punya Kelas" value={withoutClass} icon={Users} />
            <Metric label="Dokumen Guru" value={documentCount} icon={BookOpen} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Kelas Aktif" value={classRooms.length} helper="Roster sekolah bersama" />
        <SummaryCard label="Jurnal" value={journalCount} helper="Catatan pembelajaran" />
        <SummaryCard label="Penilaian" value={assessmentCount} helper="Rekam evaluasi guru" />
      </div>

      <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-extrabold text-slate-950">Monitoring Guru</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cari guru dan cek kelas yang sedang dikelola tanpa mengubah data guru.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari guru, mapel, email..."
                  className="w-full rounded-2xl pl-9 sm:w-72"
                />
              </div>
              <div className="flex gap-2">
                {[
                  { id: "all", label: "Semua" },
                  { id: "with-class", label: "Punya kelas" },
                  { id: "without-class", label: "Belum kelas" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id as typeof filter)}
                    className={`rounded-2xl px-3 py-2 text-xs font-extrabold transition ${
                      filter === item.id
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-emerald-100 p-8 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-950">Data guru tidak ditemukan</p>
              <p className="mt-1 text-sm text-slate-500">
                Ubah kata kunci atau filter untuk melihat guru lain.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map(({ teacher, rooms, students, sessions, learningActivities }) => (
                <div
                  key={teacher.id}
                  className="rounded-[24px] border border-emerald-100 bg-slate-50/60 p-4"
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                          {rooms.length > 0 ? "Aktif mengelola kelas" : "Belum ada kelas"}
                        </Badge>
                        {teacher.profiles.some((profile) => profile.isPrimary) ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                            Profil utama tersedia
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-xl font-black text-slate-950">
                        {teacher.name}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {teacher.email}
                        {teacher.phone ? ` · ${teacher.phone}` : ""}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Terhubung sejak {formatDate(teacher.createdAt)}
                      </p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-4">
                        <MiniStat label="Kelas" value={rooms.length} />
                        <MiniStat label="Siswa" value={students} />
                        <MiniStat label="Absensi" value={sessions} />
                        <MiniStat label="Aktivitas" value={learningActivities} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {teacher.profiles.length === 0 ? (
                          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                            Profil mengajar belum lengkap
                          </span>
                        ) : (
                          teacher.profiles.map((profile) => (
                            <span
                              key={profile.id}
                              className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-blue-100"
                            >
                              {profile.mapel} · {profile.jenjang.toUpperCase()}
                              {profile.isPrimary ? " · utama" : ""}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-4 ring-1 ring-blue-100">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-extrabold text-slate-950">Kelas Dikelola</p>
                        <Button size="sm" variant="outline" asChild className="rounded-xl">
                          <Link href="/school/classes">Kelola kelas</Link>
                        </Button>
                      </div>
                      {rooms.length === 0 ? (
                        <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                          Guru ini sudah terhubung ke sekolah, tetapi belum menjadi
                          pengelola kelas. Admin sekolah dapat membuat kelas resmi dan
                          memilih guru ini sebagai pengelola.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {rooms.map((room) => (
                            <Link
                              key={room.id}
                              href="/school/classes"
                              className="block rounded-2xl border border-blue-50 bg-slate-50 p-3 transition hover:border-emerald-200 hover:bg-white"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-extrabold text-slate-950">
                                    {room.name}
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">
                                    {room.jenjang.toUpperCase()} · {room.tahunAjaran}
                                  </p>
                                </div>
                                <Badge variant="outline">
                                  {room.counts.students} siswa
                                </Badge>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {room.counts.sessions} absensi · {room.counts.assessments} penilaian ·{" "}
                                {room.counts.assignments + room.counts.quizzes + room.counts.exams} aktivitas online
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <Icon className="mb-3 h-5 w-5 text-emerald-600" />
      <p className="text-2xl font-black text-slate-950">{value}</p>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <Card className="rounded-[22px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
      <CardContent className="p-5">
        <ClipboardList className="mb-3 h-5 w-5 text-emerald-600" />
        <p className="text-2xl font-extrabold text-slate-950">{value}</p>
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        <p className="mt-1 text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-blue-100">
      <p className="text-lg font-black text-slate-950">{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
