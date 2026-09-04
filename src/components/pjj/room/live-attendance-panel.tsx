"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnectionState, useParticipants, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  attendanceLabel,
  ATTENDANCE_STATUSES,
  decodeRoomData,
  encodeRoomData,
  formatDuration,
  isAuthorizedRoomDataMessage,
  type AttendanceStatus,
} from "@/components/pjj/room/live-room-data";
import { readResponseJson } from "@/lib/http-json";
import { createSingleFlightRunner } from "@/lib/pjj-single-flight";
import { pjjPresenceLabel, roomAttendancePresence } from "@/lib/pjj-attendance-presence";

const PRESENCE_EVENTS = [RoomEvent.ParticipantActive, RoomEvent.ConnectionQualityChanged];

type RosterStudent = {
  studentId: string;
  userId: string | null;
  name: string;
  nis?: string | null;
  attendanceStatus: string;
  totalSeconds: number;
  online: boolean;
  liveKitParticipantSid: string | null;
  joinCount: number;
};

type RosterResponse = {
  students: RosterStudent[];
  summary: { totalStudents: number; present: number; online: number };
  viewer: { isModerator: boolean; studentId: string | null };
  error?: string;
};

export function LiveAttendancePanel({ liveSessionId }: { liveSessionId: string }) {
  const room = useRoomContext();
  const connection = useConnectionState(room);
  const peers = useParticipants({ room, updateOnlyOn: PRESENCE_EVENTS });
  const [data, setData] = useState<RosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<ReturnType<typeof createSingleFlightRunner> | null>(null);
  const mutationRef = useRef<ReturnType<typeof createSingleFlightRunner> | null>(null);

  const load = useCallback(async () => {
    const runner = (requestRef.current ??= createSingleFlightRunner({ timeoutMs: 15000 }));
    const result = await runner.run(async (signal) => {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/roster`, {
        cache: "no-store",
        signal,
      });
      const json = (await readResponseJson(response)) as RosterResponse;
      if (!response.ok) throw new Error(json.error || "Gagal memuat absensi.");
      return json;
    });
    if (requestRef.current !== runner) return;
    if (result.status === "success") {
      setData(result.value);
      setError(null);
      setLoading(false);
    } else if (result.status === "error") {
      setError(result.error instanceof Error ? result.error.message : "Gagal memuat absensi.");
      setLoading(false);
    }
  }, [liveSessionId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 12000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      requestRef.current?.stop();
      requestRef.current = null;
      mutationRef.current?.stop();
      mutationRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: { identity: string; name?: string; metadata?: string }
    ) => {
      const message = decodeRoomData(payload);
      if (
        message?.type === "att:refresh" &&
        isAuthorizedRoomDataMessage(message, participant)
      ) {
        void load();
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    // Fetch fresh persistence after connection changes, without deriving the
    // live Online badge from the slower webhook snapshot.
    const refresh = () => void load();
    room.on(RoomEvent.ParticipantActive, refresh);
    room.on(RoomEvent.ParticipantDisconnected, refresh);
    room.on(RoomEvent.Reconnected, refresh);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.ParticipantActive, refresh);
      room.off(RoomEvent.ParticipantDisconnected, refresh);
      room.off(RoomEvent.Reconnected, refresh);
    };
  }, [room, load]);

  async function updateStatus(studentId: string, attendanceStatus: AttendanceStatus) {
    const runner = (mutationRef.current ??= createSingleFlightRunner({ timeoutMs: 15000 }));
    if (runner.running) return;
    setBusyId(studentId);
    const result = await runner.run(async (signal) => {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, attendanceStatus }),
        signal,
      });
      const json = await readResponseJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan absensi.");
    });
    if (mutationRef.current !== runner || result.status === "aborted" || result.status === "skipped") return;
    setBusyId(null);
    if (result.status === "success") {
      await load();
      if (mutationRef.current !== runner) return;
      try {
        await room.localParticipant.publishData(encodeRoomData({ type: "att:refresh" }), {
          reliable: true,
        });
      } catch {
        // ignore broadcast failure
      }
    } else {
      setError(result.error instanceof Error ? result.error.message : "Gagal menyimpan absensi.");
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat absensi...
      </div>
    );
  }

  const isModerator = data?.viewer.isModerator ?? false;
  const peersByIdentity = new Map(peers.map((peer) => [peer.identity, peer]));
  const students = (data?.students ?? []).map((student) => {
    const peer = student.userId ? peersByIdentity.get(`user:${student.userId}`) : undefined;
    const presence = roomAttendancePresence(connection, peer);
    const pendingSync = !error && (
      (presence === "online" && (!student.online || student.liveKitParticipantSid !== peer?.sid)) ||
      (presence === "offline" && student.online)
    );
    return { ...student, presence, pendingSync };
  });
  const onlineCount = students.filter((student) => student.presence === "online").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Absensi sesi</p>
          <p className="text-[11px] text-slate-400">
            {data?.summary.present ?? 0}/{data?.summary.totalStudents ?? 0} hadir tercatat ·{" "}
            {connection === "connected" ? `${onlineCount} online${isModerator ? "" : " (Anda)"}` : "koneksi belum terverifikasi"}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>
          <RefreshCw data-icon="inline-start" />
          Segarkan
        </Button>
      </div>

      <p className="text-xs text-slate-300">
        Online menunjukkan koneksi ruang saat ini. Kehadiran dihitung otomatis dari durasi;
        hasil diperbarui setelah siswa keluar. Pilihan di bawah hanya untuk koreksi guru.
      </p>
      {students.some((student) => student.pendingSync) ? (
        <p role="status" className="text-xs text-slate-300">
          Catatan kehadiran belum tersinkron dengan koneksi ruang. Jika berlanjut setelah
          disegarkan, minta admin memeriksa webhook LiveKit.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {students.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
          <Users className="mx-auto mb-2 h-5 w-5" />
          Belum ada siswa di roster kelas ini.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {students.map((student) => (
            <div
              key={student.studentId}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 [content-visibility:auto] [contain-intrinsic-size:112px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{student.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {student.nis || "Tanpa NIS"} · {formatDuration(student.totalSeconds)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={student.presence === "online" ? "success" : student.presence === "offline" ? "secondary" : "warning"}>
                    {pjjPresenceLabel[student.presence]}
                  </Badge>
                  <span className="text-[11px] font-semibold text-slate-300">
                    {attendanceLabel(student.attendanceStatus)}
                  </span>
                  {student.pendingSync ? <Badge variant="warning">Absensi belum tersinkron</Badge> : null}
                </div>
              </div>
              {isModerator ? (
                <label className="mt-2 flex flex-col gap-1 text-xs text-slate-300">
                  Koreksi kehadiran
                  <select
                    aria-label={`Koreksi kehadiran ${student.name}`}
                    className="h-8 w-full rounded-md border border-white/15 bg-slate-950 px-2 text-xs text-white"
                    value={student.attendanceStatus}
                    disabled={busyId !== null}
                    onChange={(event) =>
                      void updateStatus(student.studentId, event.target.value as AttendanceStatus)
                    }
                  >
                    {ATTENDANCE_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {attendanceLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
