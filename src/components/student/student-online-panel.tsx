"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/http-json";
import { startVisiblePresencePolling } from "@/lib/presence-polling";
import { presenceStatus, type StudentPresenceResponse } from "@/lib/student-presence-policy";

export function StudentOnlinePanel({ scopeLabel }: { scopeLabel: string }) {
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ key: string; data: StudentPresenceResponse; receivedAt: number } | null>(null);
  const key = `${showAll ? "all" : "online"}:${page}`;
  const snapshot = result?.key === key ? result : null;
  const data = snapshot?.data;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const stop = startVisiblePresencePolling(async (signal) => {
      if (!active || signal.aborted) return;
      setBusy(true);
      try {
        const response = await fetch(`/api/student-presence?status=${showAll ? "all" : "online"}&page=${page}`, {
          cache: "no-store", credentials: "same-origin", signal,
        });
        const payload = await readResponseJson<StudentPresenceResponse>(response);
        if (!active || signal.aborted) return;
        if (!response.ok) {
          setError(payload.error ?? "Status siswa belum dapat diperbarui.");
          return response.status !== 401 && response.status !== 403;
        }
        const receivedAt = Date.now();
        setResult({ key, data: payload, receivedAt });
        setNow(receivedAt);
        setError("");
      } catch {
        if (active && document.visibilityState === "visible") setError("Koneksi pemantauan terputus. Status online belum dapat dipastikan.");
      } finally {
        if (active) setBusy(false);
      }
    });
    return () => { active = false; stop(); };
  }, [showAll, page, refresh, key]);

  const serverNow = snapshot
    ? new Date(Date.parse(snapshot.data.checkedAt) + Math.max(0, now - snapshot.receivedAt))
    : new Date(0);
  const rows = (data?.students ?? []).map((student) => ({ ...student,
    status: presenceStatus(student.lastSeenAt ? new Date(student.lastSeenAt) : null, serverNow),
  })).filter((student) => showAll || student.status === "online");
  const pageCount = data ? Math.max(1, Math.ceil(data.filteredTotal / data.pageSize)) : 1;
  const formatTime = (value: string) => new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });

  return <section className="flex flex-col gap-5">
    <div>
      <h1 className="text-2xl font-bold">Siswa Online</h1>
      <p className="mt-2 text-sm text-muted-foreground">{scopeLabel}</p>
    </div>
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas siswa saat ini</CardTitle>
        <CardDescription>Online berarti aplikasi aktif di layar dan mengirim kabar dalam 2 menit terakhir. Bukan bukti kehadiran atau aktivitas belajar.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite">
            {!error && data ? `${data.online} online dari ${data.total} siswa berakun pada pembaruan terakhir` : "Status belum tersedia"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" aria-pressed={showAll} onClick={() => { setShowAll((value) => !value); setPage(1); }}>
              {showAll ? "Hanya siswa online" : "Tampilkan semua siswa"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>Perbarui</Button>
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> :
          !data ? <p role="status" className="text-sm text-muted-foreground">Memuat status siswa…</p> :
          rows.length === 0 ? <p role="status" className="text-sm text-muted-foreground">
            {showAll ? "Tidak ada siswa berakun pada halaman ini." : "Belum ada siswa online pada halaman ini."}
          </p> : <ul className="flex flex-col gap-3" aria-label="Daftar status siswa">
            {rows.map((student) => <li key={student.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0 flex-1">
                <p className="break-words font-semibold">{student.name}</p>
                <p className="break-words text-sm text-muted-foreground">{student.className} · {student.schoolName ?? "Sekolah belum dihubungkan"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{student.lastSeenAt
                  ? `Terakhir aktif: ${formatTime(student.lastSeenAt)}`
                  : "Belum ada sinyal dari web / APK yang mendukung pemantauan."}</p>
              </div>
              <Badge variant={student.status === "online" ? "success" : "outline"}>
                {student.status === "online" ? "Online" : student.status === "offline" ? "Offline" : "Belum terpantau"}
              </Badge>
            </li>)}
          </ul>}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Diperbarui setiap 45 detik saat halaman aktif.
          {!error && data ? ` Pembaruan: ${formatTime(data.checkedAt)}.` : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={page <= 1 || busy} onClick={() => setPage((value) => value - 1)}>Sebelumnya</Button>
          <span className="text-sm">Halaman {page}{data ? ` / ${pageCount}` : ""}</span>
          <Button variant="outline" disabled={!data || page >= pageCount || busy || Boolean(error)} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
        </div>
      </CardFooter>
    </Card>
    <p className="text-sm text-muted-foreground">Setelah logout, menutup aplikasi, atau kehilangan koneksi, status dapat bertahan hingga sekitar 2 menit. APK lama belum mengirim sinyal pemantauan. Tidak ada lokasi, isi layar, atau riwayat kegiatan yang direkam.</p>
  </section>;
}
