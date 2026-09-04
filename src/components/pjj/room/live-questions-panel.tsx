"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { CheckCircle2, Hand, Loader2, MessageCircleQuestion, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  decodeRoomData,
  encodeRoomData,
  isAuthorizedRoomDataMessage,
} from "@/components/pjj/room/live-room-data";
import { readResponseJson } from "@/lib/http-json";
import { createSingleFlightRunner } from "@/lib/pjj-single-flight";

type Question = {
  id: string;
  body: string;
  isHandRaise: boolean;
  status: "OPEN" | "ANSWERED" | "DISMISSED";
  createdAt: string;
  user: { id: string; name: string };
  student?: { id: string; name: string; nis?: string | null } | null;
};

export function LiveQuestionsPanel({
  liveSessionId,
  isModerator,
  onOpenCountChange,
}: {
  liveSessionId: string;
  isModerator: boolean;
  onOpenCountChange?: (count: number) => void;
}) {
  const room = useRoomContext();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<ReturnType<typeof createSingleFlightRunner> | null>(null);

  const load = useCallback(async () => {
    const runner = (requestRef.current ??= createSingleFlightRunner());
    const result = await runner.run(async (signal) => {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/questions`, {
        cache: "no-store",
        signal,
      });
      const json = await readResponseJson<{
        questions?: Question[];
        openCount?: number;
      }>(response);
      if (!response.ok) throw new Error(json.error || "Gagal memuat pertanyaan.");
      return json;
    });
    if (result.status === "success") {
      setQuestions(result.value.questions || []);
      setOpenCount(result.value.openCount || 0);
      onOpenCountChange?.(result.value.openCount || 0);
      setError(null);
      setLoading(false);
    } else if (result.status === "error") {
      setError(result.error instanceof Error ? result.error.message : "Gagal memuat pertanyaan.");
      setLoading(false);
    }
  }, [liveSessionId, onOpenCountChange]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current?.stop();
      requestRef.current = null;
    };
  }, [load]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: { identity: string; name?: string; metadata?: string }
    ) => {
      const message = decodeRoomData(payload);
      if (
        (message?.type === "q:new" || message?.type === "q:update") &&
        isAuthorizedRoomDataMessage(message, participant)
      ) {
        void load();
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, load]);

  async function submit(isHandRaise: boolean) {
    const text = body.trim() || (isHandRaise ? "Angkat tangan" : "");
    if (!text) {
      setError("Tulis pertanyaan terlebih dahulu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, isHandRaise }),
      });
      const json = await readResponseJson<{ question: { id: string } }>(response);
      if (!response.ok) throw new Error(json.error || "Gagal mengirim.");
      setBody("");
      await load();
      try {
        await room.localParticipant.publishData(
          encodeRoomData({ type: "q:new", questionId: json.question.id }),
          { reliable: true }
        );
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(questionId: string, status: "ANSWERED" | "DISMISSED") {
    setBusy(true);
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await readResponseJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal memperbarui.");
      await load();
      try {
        await room.localParticipant.publishData(
          encodeRoomData({ type: "q:update", questionId, status }),
          { reliable: true }
        );
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat antrean...
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-white">Tanya & angkat tangan</p>
        <p className="text-[11px] text-slate-400">{openCount} pertanyaan terbuka</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      {!isModerator ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
          <Textarea
            rows={3}
            placeholder="Tulis pertanyaan untuk guru..."
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="border-white/15 bg-slate-950 text-sm text-white placeholder:text-slate-500"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit(false)}>
              <MessageCircleQuestion className="h-3.5 w-3.5" />
              Kirim pertanyaan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              <Hand className="h-3.5 w-3.5" />
              Angkat tangan
            </Button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
            Belum ada pertanyaan.
          </div>
        ) : (
          questions.map((question) => (
            <div
              key={question.id}
              className={`rounded-2xl border px-3 py-3 [content-visibility:auto] [contain-intrinsic-size:140px] ${
                question.status === "OPEN"
                  ? "border-cyan-400/30 bg-cyan-400/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-white">
                  {question.student?.name || question.user.name}
                </p>
                {question.isHandRaise ? (
                  <Badge className="bg-amber-400/20 text-amber-100 hover:bg-amber-400/20">
                    <Hand className="mr-1 h-3 w-3" />
                    Angkat tangan
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-white/20 text-slate-300">
                  {question.status}
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">{question.body}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {new Date(question.createdAt).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {isModerator && question.status === "OPEN" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void updateStatus(question.id, "ANSWERED")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Sudah dijawab
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void updateStatus(question.id, "DISMISSED")}
                  >
                    <X className="h-3.5 w-3.5" />
                    Tutup
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
