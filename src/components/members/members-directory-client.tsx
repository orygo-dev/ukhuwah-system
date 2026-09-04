"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  GraduationCap,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  School,
  Users,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  jenjangLabel,
  memberAvatarFallback,
  type MemberCard,
} from "@/lib/member-directory";

type MembersResponse = {
  members: MemberCard[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { mapelOptions: string[]; jenjangOptions: string[] };
  stats: { totalMembers: number };
};

function MemberAvatar({ member }: { member: MemberCard }) {
  const src = member.avatarUrl || memberAvatarFallback(member.name);
  const isExternal = src.startsWith("http");

  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-background shadow-md ring-2 ring-primary/10">
      {isExternal ? (
        <Image
          src={src}
          alt={member.name}
          fill
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white">
          {member.initials}
        </div>
      )}
    </div>
  );
}

export function MembersDirectoryClient() {
  const { data: session } = useSession();
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [jenjang, setJenjang] = useState("all");
  const [mapel, setMapel] = useState("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q.trim()) params.set("q", q.trim());
    if (jenjang !== "all") params.set("jenjang", jenjang);
    if (mapel !== "all") params.set("mapel", mapel);

    const res = await fetch(`/api/members?${params}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Gagal memuat");
    setData(json);
    setLoading(false);
  }, [q, jenjang, mapel, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, jenjang, mapel]);

  return (
    <DashboardShell
      activePath="/dashboard/member"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="space-y-8">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 px-6 py-8 text-white shadow-lg lg:px-10">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-teal-300/10 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-emerald-200">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium tracking-wide uppercase">
                Komunitas Guru
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight lg:text-3xl">
              Direktori Member
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 lg:text-base">
              Jelajahi jaringan guru di Navalogi — lihat sekolah, mata pelajaran,
              dan kelas yang diampu oleh sesama pendidik.
            </p>
            {data && (
              <p className="mt-4 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm backdrop-blur">
                <span className="font-semibold text-emerald-300">
                  {data.stats.totalMembers}
                </span>
                <span className="ml-1.5 text-slate-300">guru terdaftar</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama, sekolah, mapel, atau kelas..."
              className="pl-9"
            />
          </div>
          <Select value={jenjang} onValueChange={setJenjang}>
            <SelectTrigger className="w-full lg:w-[160px]">
              <SelectValue placeholder="Jenjang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua jenjang</SelectItem>
              {(data?.filters.jenjangOptions || []).map((j) => (
                <SelectItem key={j} value={j}>
                  {jenjangLabel(j)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={mapel} onValueChange={setMapel}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Mapel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua mapel</SelectItem>
              {(data?.filters.mapelOptions || []).map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data?.members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Tidak ada member ditemukan</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Coba ubah kata kunci atau filter pencarian.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div
              className={cn(
                "grid gap-5 sm:grid-cols-2 xl:grid-cols-3",
                loading && "opacity-60"
              )}
            >
              {data?.members.map((member) => (
                <Card
                  key={member.id}
                  className="group overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
                >
                  <CardContent className="p-0">
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-80 transition-opacity group-hover:opacity-100" />
                    <div className="p-5">
                      <div className="flex gap-4">
                        <MemberAvatar member={member} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-semibold leading-tight tracking-tight">
                              {member.name}
                            </h3>
                            {member.planName && (
                              <Badge
                                variant="secondary"
                                className="shrink-0 bg-amber-100 text-amber-800 text-[10px]"
                              >
                                {member.planName}
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <School className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span className="line-clamp-2">{member.schoolName}</span>
                          </div>
                          {member.schoolCity && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {member.schoolCity}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-3">
                        <div>
                          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            <BookOpen className="h-3 w-3" />
                            Mapel
                          </p>
                          <p className="mt-0.5 text-sm font-medium">{member.mapel}</p>
                        </div>
                        <div>
                          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            <GraduationCap className="h-3 w-3" />
                            Jenjang
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {jenjangLabel(member.jenjang)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button size="sm" variant="brand" asChild>
                          <Link href={`/dashboard/pesan?start=${member.id}`}>
                            <MessageCircle className="mr-1 h-4 w-4" />
                            Kirim Pesan
                          </Link>
                        </Button>
                      </div>

                      <div className="mt-4">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Kelas diampu
                        </p>
                        {member.classes.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {member.classes.map((cls) => (
                              <Badge
                                key={cls.id}
                                variant="outline"
                                className="border-primary/20 bg-primary/5 text-xs font-normal"
                              >
                                {cls.name}
                                <span className="ml-1 text-muted-foreground">
                                  · {cls.tahunAjaran}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            Belum ada kelas terdaftar
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-muted-foreground">
                  Halaman {data.pagination.page} dari {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
