"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Send,
  Settings2,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { readResponseJson } from "@/lib/http-json";

type ChatUser = {
  id: string;
  name: string;
  avatarUrl: string;
  initials: string;
};

type ConversationRow = {
  id: string;
  otherUser: ChatUser | null;
  lastMessage: {
    content: string;
    createdAt: string;
    isMine: boolean;
  } | null;
  unread: boolean;
  updatedAt: string;
};

type MessageRow = {
  id: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  senderName: string;
};

function Avatar({ user, size = 40 }: { user: ChatUser; size?: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-full border bg-muted"
      style={{ width: size, height: size }}
    >
      <Image
        src={user.avatarUrl}
        alt={user.name}
        fill
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function ChatPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startUserId = searchParams.get("start");
  const { data: session } = useSession();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [allowMessages, setAllowMessages] = useState(true);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find((c) => c.id === activeId);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/conversations");
    const data = await readResponseJson<{ conversations?: ConversationRow[] }>(res);
    if (res.ok) setConversations(data.conversations || []);
    return data;
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/chat/conversations/${conversationId}`);
    const data = await readResponseJson<{ messages?: MessageRow[] }>(res);
    if (res.ok) setMessages(data.messages || []);
    await fetch(`/api/chat/conversations/${conversationId}`, {
      method: "PATCH",
    });
  }, []);

  const startWithUser = useCallback(
    async (recipientId: string) => {
      const res = await fetch("/api/chat/conversations/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      const data = await readResponseJson<{
        error?: string;
        conversation?: { id: string };
      }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal memulai chat");
      await loadConversations();
      setActiveId(data.conversation!.id);
      setMobileShowChat(true);
      router.replace("/dashboard/pesan");
    },
    [loadConversations, router]
  );

  useEffect(() => {
    Promise.all([
      loadConversations(),
      fetch("/api/chat/settings")
        .then((r) => readResponseJson<{ allowMessages?: boolean }>(r))
        .then((d) => setAllowMessages(!!d.allowMessages)),
    ])
      .finally(() => setLoading(false));
  }, [loadConversations]);

  useEffect(() => {
    if (!startUserId || loading) return;
    startWithUser(startUserId).catch(() => undefined);
  }, [startUserId, loading, startWithUser]);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
  }, [activeId, loadMessages, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/chat/stream");
      es.addEventListener("message", () => {
        if (activeId) loadMessages(activeId);
        loadConversations();
      });
    } catch {
      /* polling fallback */
    }
    return () => es?.close();
  }, [activeId, loadMessages, loadConversations]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const data = await readResponseJson<{ message?: MessageRow }>(res);
      if (!res.ok) throw new Error(data.error || "Gagal mengirim");
      setDraft("");
      const message = data.message;
      if (message) setMessages((prev) => [...prev, message]);
      loadConversations();
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  };

  const saveSettings = async (value: boolean) => {
    setAllowMessages(value);
    await fetch("/api/chat/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowMessages: value }),
    });
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/pesan">
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      activePath="/dashboard/pesan"
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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-primary" />
            Pesan
          </h1>
          <p className="text-sm text-muted-foreground">
            Chat pribadi dengan sesama guru di Navalogi
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings((s) => !s)}
        >
          <Settings2 className="mr-1 h-4 w-4" />
          Privasi
        </Button>
      </div>

      {showSettings && (
        <Card className="mb-4 flex items-center justify-between p-4">
          <div>
            <Label>Terima pesan dari member lain</Label>
            <p className="text-xs text-muted-foreground">
              Matikan jika Anda tidak ingin dihubungi lewat chat
            </p>
          </div>
          <Switch checked={allowMessages} onCheckedChange={saveSettings} />
        </Card>
      )}

      <Card className="overflow-hidden border shadow-sm">
        <div className="flex h-[calc(100vh-14rem)] min-h-[480px]">
          {/* Conversation list */}
          <div
            className={cn(
              "w-full border-r bg-muted/20 md:w-80 lg:w-96",
              mobileShowChat && "hidden md:block"
            )}
          >
            <div className="border-b bg-card px-4 py-3 text-sm font-medium">
              Percakapan ({conversations.length})
            </div>
            <div className="overflow-y-auto h-[calc(100%-3rem)]">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-8 w-8 opacity-40" />
                  <p>Belum ada percakapan</p>
                  <p className="text-xs">
                    Mulai dari halaman Member → Kirim Pesan
                  </p>
                </div>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setActiveId(c.id);
                      setMobileShowChat(true);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-card",
                      activeId === c.id && "bg-card"
                    )}
                  >
                    {c.otherUser && <Avatar user={c.otherUser} size={44} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            c.unread && "font-semibold"
                          )}
                        >
                          {c.otherUser?.name || "Guru"}
                        </p>
                        {c.lastMessage && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatTime(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "truncate text-xs text-muted-foreground",
                          c.unread && "text-foreground"
                        )}
                      >
                        {c.lastMessage
                          ? `${c.lastMessage.isMine ? "Anda: " : ""}${c.lastMessage.content}`
                          : "Belum ada pesan"}
                      </p>
                    </div>
                    {c.unread && (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat panel */}
          <div
            className={cn(
              "flex flex-1 flex-col bg-card",
              !mobileShowChat && "hidden md:flex"
            )}
          >
            {!activeConversation?.otherUser ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageCircle className="h-12 w-12 opacity-30" />
                <p className="text-sm">Pilih percakapan untuk mulai mengobrol</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setMobileShowChat(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar user={activeConversation.otherUser} size={36} />
                  <div>
                    <p className="font-semibold text-sm">
                      {activeConversation.otherUser.name}
                    </p>
                    <p className="text-xs text-muted-foreground">Navalogi Member</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex",
                        m.isMine ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                          m.isMine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {m.content}
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            m.isMine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                <form
                  onSubmit={sendMessage}
                  className="flex gap-2 border-t p-4"
                >
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Tulis pesan..."
                    maxLength={2000}
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    variant="brand"
                    disabled={!draft.trim() || sending}
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </Card>
    </DashboardShell>
  );
}
