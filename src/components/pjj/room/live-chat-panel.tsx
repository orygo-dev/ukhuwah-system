"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decodeRoomData, isTrustedPersistedChat } from "@/components/pjj/room/live-room-data";
import {
  appendPersistedChat,
  markChatFailed,
  mergeChatHistory,
  settlePendingChat,
  type PjjChatItem as ChatItem,
} from "@/lib/pjj-chat-state";

async function readChatJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "Respons chat kosong dari server."
        : `Gagal memuat chat (HTTP ${response.status}).`
    );
  }
  try {
    return JSON.parse(text) as { error?: string; messages?: ChatItem[]; message?: ChatItem };
  } catch {
    throw new Error(
      response.ok
        ? "Respons chat bukan JSON valid."
        : `Gagal memuat chat (HTTP ${response.status}).`
    );
  }
}

export function LiveChatPanel({
  liveSessionId,
  active,
  onUnreadIncrement,
}: {
  liveSessionId: string;
  active: boolean;
  onUnreadIncrement?: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  const unreadCallbackRef = useRef(onUnreadIncrement);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/chat`, {
        cache: "no-store",
      });
      const json = await readChatJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal memuat chat.");
      setMessages((current) => mergeChatHistory(current, (json.messages || []) as ChatItem[]));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat chat.");
    }
  }, [liveSessionId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    activeRef.current = active;
    unreadCallbackRef.current = onUnreadIncrement;
  }, [active, onUnreadIncrement]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: { identity: string; name?: string; metadata?: string }
    ) => {
      const message = decodeRoomData(payload);
      // RoomService broadcasts have no participant sender. Client-originated
      // packets are never accepted as authoritative chat messages.
      if (!isTrustedPersistedChat(message, participant)) return;
      const trustedMessage: ChatItem = message;
      setMessages((current) => appendPersistedChat(current, trustedMessage));
      if (!activeRef.current && trustedMessage.senderIdentity !== localParticipant.identity) {
        unreadCallbackRef.current?.();
      }
    };
    const onReconnected = () => void loadHistory();
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, localParticipant.identity, loadHistory]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, active]);

  async function persist(item: ChatItem, clientMessageId: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === item.id ? { ...message, status: "pending" as const } : message
      )
    );
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientMessageId, body: item.body }),
      });
      const json = await readChatJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal mengirim pesan.");
      const persisted = json.message as ChatItem;
      setMessages((current) => settlePendingChat(current, item.id, persisted));
      setError(null);
    } catch (sendError) {
      setMessages((current) => markChatFailed(current, item.id));
      setError(sendError instanceof Error ? sendError.message : "Gagal mengirim pesan. Coba lagi.");
    }
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    const clientMessageId = crypto.randomUUID();
    const item: ChatItem = {
      id: `pending:${clientMessageId}`,
      body: text.slice(0, 500),
      senderName: localParticipant.name || "Peserta",
      senderIdentity: localParticipant.identity,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    setBody("");
    setMessages((current) => [...current, item].slice(-200));
    await persist(item, clientMessageId);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-white">Chat kelas</p>
        <p className="text-[11px] text-slate-400">Pesan hanya terlihat selama sesi live berlangsung.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
            <MessageSquare className="mx-auto mb-2 h-5 w-5" />
            Belum ada chat. Mulai percakapan dengan kelas.
          </div>
        ) : (
          messages.map((item) => {
            const mine = item.senderIdentity === localParticipant.identity;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border px-3 py-2 [content-visibility:auto] [contain-intrinsic-size:84px] ${
                  mine ? "border-cyan-400/30 bg-cyan-400/10" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">{item.senderName}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(item.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-200">{item.body}</p>
                {item.status ? (
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-amber-200">
                    <span>{item.status === "pending" ? "Mengirim..." : "Gagal terkirim"}</span>
                    {item.status === "failed" ? (
                      <button
                        type="button"
                        className="underline"
                        onClick={() => void persist(item, item.id.replace(/^pending:/, ""))}
                      >
                        Coba lagi
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Tulis pesan..."
          maxLength={500}
          className="border-white/15 bg-slate-950 text-white placeholder:text-slate-500 sm:bg-slate-950 sm:text-white"
        />
        <Button type="submit" size="icon" aria-label="Kirim chat">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
