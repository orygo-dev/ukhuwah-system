"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, BellRing, CheckCheck, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncWebPush, type WebPushResult } from "@/lib/firebase-web-push";

type InboxItem = {
  id: string;
  readAt: string | null;
  notification: {
    id: string;
    title: string;
    message: string;
    category: string;
    priority: "NORMAL" | "IMPORTANT" | "URGENT";
    actionUrl: string | null;
    publishAt: string;
    sender: { name: string; role: string };
  };
};

function centerHref(role?: string) {
  if (role === "SUPER_ADMIN") return "/admin/notifications?tab=inbox";
  if (role === "PROVINCE_ADMIN") return "/province/notifications?tab=inbox";
  if (role === "SCHOOL_ADMIN") return "/school/notifications?tab=inbox";
  if (role === "STUDENT") return "/student/notifications";
  return "/dashboard/notifications?tab=inbox";
}

export function NotificationBell({ className }: { className?: string }) {
  const { data: session } = useSession();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<WebPushResult | "ENABLING">("PROMPT");

  useEffect(() => {
    if (!("Notification" in window)) {
      setPushStatus("UNSUPPORTED");
      return;
    }
    if (Notification.permission === "denied") {
      setPushStatus("DENIED");
      return;
    }
    if (Notification.permission === "granted") {
      void syncWebPush(false).then(setPushStatus).catch(() => setPushStatus("NOT_CONFIGURED"));
    }
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/notifications?limit=6", { cache: "no-store", signal });
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[notification load]", error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const markRead = async (recipientId: string) => {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    });
    if (response.ok) {
      setItems((current) => current.map((item) => (item.id === recipientId ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnreadCount((current) => Math.max(0, current - 1));
    }
  };

  const markAllRead = async () => {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    if (response.ok) {
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    }
  };

  const enablePush = async () => {
    setPushStatus("ENABLING");
    try {
      setPushStatus(await syncWebPush(true));
    } catch (error) {
      console.error("[enable web push]", error);
      setPushStatus("NOT_CONFIGURED");
    }
  };

  const openItem = async (item: InboxItem) => {
    if (!item.readAt) await markRead(item.id);
    setOpen(false);
    router.push(item.notification.actionUrl || centerHref(session?.user.role));
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative h-10 w-10 rounded-full border border-emerald-100 bg-white text-slate-700 shadow-sm hover:bg-emerald-50"
        aria-label={`Pemberitahuan${unreadCount ? `, ${unreadCount} belum dibaca` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {unreadCount > 0 ? <BellRing className="h-5 w-5 text-emerald-700" /> : <Bell className="h-5 w-5" />}
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-12 z-[70] w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.2)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <p className="font-black text-slate-950">Pemberitahuan</p>
              <p className="text-xs font-semibold text-slate-500">{unreadCount} belum dibaca</p>
            </div>
            {unreadCount > 0 ? (
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 hover:text-emerald-900">
                <CheckCheck className="h-4 w-4" /> Tandai semua
              </button>
            ) : null}
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {pushStatus !== "ENABLED" && pushStatus !== "UNSUPPORTED" ? (
              <button
                type="button"
                disabled={pushStatus === "ENABLING"}
                onClick={() => void enablePush()}
                className="mb-2 flex w-full items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-left text-xs font-extrabold text-emerald-800 disabled:opacity-60"
              >
                <span>
                  {pushStatus === "DENIED"
                    ? "Izinkan notifikasi melalui pengaturan browser"
                    : pushStatus === "NOT_CONFIGURED"
                      ? "Push web belum dikonfigurasi admin"
                      : "Aktifkan push notification browser"}
                </span>
                <BellRing className="h-4 w-4" />
              </button>
            ) : null}
            {loading ? <p className="p-5 text-center text-sm text-slate-500">Memuat pemberitahuan...</p> : null}
            {!loading && items.length === 0 ? (
              <div className="grid place-items-center gap-2 px-5 py-10 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Inbox className="h-5 w-5" /></span>
                <p className="text-sm font-bold text-slate-700">Belum ada pemberitahuan</p>
              </div>
            ) : null}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openItem(item)}
                className={cn(
                  "mb-1 flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-emerald-50",
                  item.readAt ? "bg-white" : "bg-emerald-50/70"
                )}
              >
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", item.readAt ? "bg-slate-200" : item.notification.priority === "URGENT" ? "bg-red-600" : "bg-emerald-600")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-slate-950">{item.notification.title}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-600">{item.notification.message}</span>
                  <span className="mt-1.5 block text-[10px] font-bold text-slate-400">{item.notification.sender.name} · {new Date(item.notification.publishAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); router.push(centerHref(session?.user.role)); }}
            className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50"
          >
            Lihat semua pemberitahuan <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
