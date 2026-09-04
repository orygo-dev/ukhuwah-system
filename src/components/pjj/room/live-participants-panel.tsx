"use client";

import { useEffect, useState } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import { Mic, MicOff, UserMinus, Users, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { encodeRoomData } from "@/components/pjj/room/live-room-data";
import { readResponseJson } from "@/lib/http-json";

function identityToUserId(identity: string) {
  return identity.startsWith("user:") ? identity.slice(5) : identity;
}

type RosterStudent = {
  userId?: string | null;
  canPublishMedia?: boolean;
};

export function LiveParticipantsPanel({
  liveSessionId,
  isModerator,
  roomMode = "MEETING",
}: {
  liveSessionId: string;
  isModerator: boolean;
  roomMode?: "MEETING" | "CLASSROOM";
}) {
  const room = useRoomContext();
  const participants = useParticipants({
    updateOnlyOn: [
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.ParticipantMetadataChanged,
    ],
  });
  const { localParticipant } = useLocalParticipant();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [publishFlags, setPublishFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      try {
        const response = await fetch(`/api/pjj/sessions/${liveSessionId}/roster`, {
          cache: "no-store",
        });
        const data = await readResponseJson<{ students?: RosterStudent[] }>(response);
        if (!response.ok || cancelled) return;
        const next: Record<string, boolean> = {};
        for (const student of data.students || []) {
          if (student.userId) {
            next[student.userId] = Boolean(student.canPublishMedia);
          }
        }
        setPublishFlags(next);
      } catch {
        // ignore roster failures for live panel
      }
    }
    void loadRoster();
    return () => {
      cancelled = true;
    };
  }, [liveSessionId]);

  async function moderate(body: Record<string, unknown>) {
    const response = await fetch(`/api/pjj/sessions/${liveSessionId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readResponseJson(response);
    if (!response.ok) throw new Error(data.error || "Moderasi gagal.");
    return data;
  }

  async function muteIdentity(identity: string, muted: boolean) {
    setBusyId(identity);
    setMessage(null);
    try {
      await moderate({ action: "mute", identity, muted });
      if (muted) {
        try {
          await room.localParticipant.publishData(
            encodeRoomData({ type: "mod:muted", targetIdentity: identity }),
            { reliable: true }
          );
        } catch {
          // ignore
        }
      }
      setMessage(muted ? "Mikrofon peserta dimatikan." : "Permintaan un-mute dikirim ke server.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Moderasi gagal.");
    } finally {
      setBusyId(null);
    }
  }

  async function requestUnmute(identity: string) {
    setBusyId(identity);
    setMessage(null);
    try {
      await room.localParticipant.publishData(
        encodeRoomData({
          type: "mod:request_unmute",
          targetIdentity: identity,
          byName: localParticipant.name || "Guru",
        }),
        { reliable: true }
      );
      setMessage("Permintaan nyalakan mikrofon dikirim ke peserta.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengirim permintaan.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeIdentity(identity: string) {
    if (!window.confirm("Keluarkan peserta ini dari room?")) return;
    setBusyId(identity);
    setMessage(null);
    try {
      await moderate({ action: "remove", identity });
      setMessage("Peserta dikeluarkan dari room.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengeluarkan peserta.");
    } finally {
      setBusyId(null);
    }
  }

  async function muteAll() {
    if (!window.confirm("Matikan mikrofon semua siswa?")) return;
    setBusyId("all");
    setMessage(null);
    try {
      const data = await moderate({ action: "muteAll" });
      setMessage(`Mute all selesai (${data.mutedCount || 0} track).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mute all gagal.");
    } finally {
      setBusyId(null);
    }
  }

  async function setPublish(identity: string, canPublishMedia: boolean) {
    const userId = identityToUserId(identity);
    setBusyId(identity);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/pjj/sessions/${liveSessionId}/participants/${userId}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canPublishMedia }),
        }
      );
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(data.error || "Gagal mengatur publish.");
      setPublishFlags((current) => ({ ...current, [userId]: canPublishMedia }));
      try {
        await room.localParticipant.publishData(
          encodeRoomData({
            type: "participant:publish",
            targetIdentity: identity,
            canPublishMedia,
          }),
          { reliable: true }
        );
      } catch {
        // ignore packet failure
      }
      setMessage(
        canPublishMedia
          ? "Siswa dipromote ke strip (boleh kamera/mic)."
          : "Hak publish siswa dicabut."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Promote gagal.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Peserta live</p>
          <p className="text-[11px] text-slate-400">
            {participants.length} di room
            {roomMode === "CLASSROOM" ? " · mode classroom" : ""}
          </p>
        </div>
        {isModerator ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyId === "all"}
            onClick={() => void muteAll()}
          >
            <MicOff className="h-3.5 w-3.5" />
            Mute all
          </Button>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200">
          {message}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {participants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
            <Users className="mx-auto mb-2 h-5 w-5" />
            Belum ada peserta terhubung.
          </div>
        ) : (
          participants.map((participant) => {
            const isSelf = participant.identity === localParticipant.identity;
            const micPub = participant.getTrackPublication(Track.Source.Microphone);
            const micOn = Boolean(micPub && !micPub.isMuted);
            const userId = identityToUserId(participant.identity);
            let roleLabel = "Peserta";
            let isStudent = true;
            let metaPublish = false;
            try {
              const meta = JSON.parse(participant.metadata || "{}") as {
                role?: string;
                canPublishMedia?: boolean;
              };
              if (meta.role && meta.role !== "STUDENT") {
                roleLabel = "Moderator";
                isStudent = false;
              }
              if (meta.role === "STUDENT") roleLabel = "Siswa";
              metaPublish = Boolean(meta.canPublishMedia);
            } catch {
              // ignore
            }
            const canPublish =
              !isStudent ||
              Boolean(publishFlags[userId] ?? metaPublish);

            return (
              <div
                key={participant.identity}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 [content-visibility:auto] [contain-intrinsic-size:76px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {participant.name || participant.identity}
                      {isSelf ? " (Anda)" : ""}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {roleLabel}
                      {roomMode === "CLASSROOM" && isStudent
                        ? canPublish
                          ? " · di strip"
                          : " · spectator"
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      micOn
                        ? "border-emerald-400/40 text-emerald-200"
                        : "border-white/20 text-slate-300"
                    }
                  >
                    {micOn ? (
                      <>
                        <Mic className="mr-1 h-3 w-3" />
                        Mic on
                      </>
                    ) : (
                      <>
                        <MicOff className="mr-1 h-3 w-3" />
                        Mic off
                      </>
                    )}
                  </Badge>
                </div>

                {isModerator && !isSelf ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {roomMode === "CLASSROOM" && isStudent ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={canPublish ? "secondary" : "outline"}
                        disabled={busyId === participant.identity}
                        onClick={() =>
                          void setPublish(participant.identity, !canPublish)
                        }
                      >
                        <Video className="h-3.5 w-3.5" />
                        {canPublish ? "Demote" : "Promote"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === participant.identity}
                      onClick={() => void muteIdentity(participant.identity, true)}
                    >
                      <MicOff className="h-3.5 w-3.5" />
                      Mute
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busyId === participant.identity}
                      onClick={() => void requestUnmute(participant.identity)}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Minta un-mute
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-rose-300 hover:text-rose-200"
                      disabled={busyId === participant.identity}
                      onClick={() => void removeIdentity(participant.identity)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                      Keluarkan
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
