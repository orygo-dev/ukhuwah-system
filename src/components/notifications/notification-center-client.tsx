"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, CheckCheck, ChevronRight, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

type RecipientItem = {
  id: string;
  readAt: string | null;
  notification: {
    id: string;
    title: string;
    message: string;
    category: string;
    priority: "NORMAL" | "IMPORTANT" | "URGENT";
    actionUrl: string | null;
    imageUrl: string | null;
    publishAt: string;
    expiresAt: string | null;
    sender: { name: string; role: string };
  };
};

export function NotificationCenterClient({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<RecipientItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/notifications?limit=50${filter === "unread" ? "&unread=true" : ""}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const mark = async (payload: { recipientId?: string; all?: boolean }) => {
    const response = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) await load();
  };

  const openItem = async (item: RecipientItem) => {
    if (!item.readAt) await mark({ recipientId: item.id });
    if (item.notification.actionUrl) router.push(item.notification.actionUrl);
  };

  return (
    <section className={cn(!embedded && "space-y-5")}>
      {!embedded ? (
        <div className="rounded-[28px] bg-gradient-to-br from-blue-800 via-teal-600 to-teal-500 p-6 text-white shadow-xl shadow-blue-900/10">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-100">Pusat Informasi</p>
          <h1 className="mt-2 text-3xl font-black">Pemberitahuan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">Informasi resmi dari guru, sekolah, dinas pendidikan, dan pengelola platform.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button type="button" variant={filter === "all" ? "default" : "outline"} className="rounded-xl" onClick={() => setFilter("all")}>Semua</Button>
          <Button type="button" variant={filter === "unread" ? "default" : "outline"} className="rounded-xl" onClick={() => setFilter("unread")}>Belum dibaca ({unreadCount})</Button>
        </div>
        {unreadCount > 0 ? <Button type="button" variant="ghost" className="rounded-xl text-emerald-700" onClick={() => mark({ all: true })}><CheckCheck className="h-4 w-4" /> Tandai semua dibaca</Button> : null}
      </div>

      <div className="space-y-3">
        {loading ? <Card className="rounded-[24px]"><CardContent className="p-8 text-center text-sm text-slate-500">Memuat pemberitahuan...</CardContent></Card> : null}
        {!loading && items.length === 0 ? (
          <Card className="rounded-[24px] border-dashed"><CardContent className="grid place-items-center gap-3 p-10 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Inbox /></span><div><p className="font-black text-slate-800">Tidak ada pemberitahuan</p><p className="mt-1 text-sm text-slate-500">Informasi baru akan tampil di sini.</p></div></CardContent></Card>
        ) : null}
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => openItem(item)} className="block w-full text-left">
            <Card className={cn("rounded-[24px] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg", item.readAt ? "bg-white" : "border-emerald-200 bg-emerald-50/60")}>
              <CardContent className="flex gap-4 p-5">
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", item.readAt ? "bg-slate-100 text-slate-500" : "bg-emerald-600 text-white")}>
                  {item.readAt ? <Check className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-950">{item.notification.title}</span>
                    <Badge variant="outline" className={cn("rounded-full", item.notification.priority === "URGENT" && "border-red-200 bg-red-50 text-red-700", item.notification.priority === "IMPORTANT" && "border-amber-200 bg-amber-50 text-amber-700")}>{item.notification.priority === "URGENT" ? "Mendesak" : item.notification.priority === "IMPORTANT" ? "Penting" : "Informasi"}</Badge>
                  </span>
                  <span className="mt-2 block whitespace-pre-line text-sm leading-6 text-slate-600">{item.notification.message}</span>
                  {item.notification.imageUrl ? (
                    <span className="mt-3 block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={toSameOriginUploadUrl(item.notification.imageUrl)}
                        alt=""
                        className="max-h-48 w-full object-cover"
                      />
                    </span>
                  ) : null}
                  <span className="mt-3 block text-xs font-bold text-slate-400">{item.notification.sender.name} · {new Date(item.notification.publishAt).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                {item.notification.actionUrl ? <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-emerald-500" /> : null}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}
