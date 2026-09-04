"use client";

import { useEffect, useState } from "react";

let cachedUnreadTotal = 0;
let cachedAt = 0;
let inflight: Promise<number> | null = null;
const CACHE_TTL_MS = 30_000;

async function fetchUnreadTotal(force = false) {
  const now = Date.now();
  if (!force && now - cachedAt < CACHE_TTL_MS) return cachedUnreadTotal;
  if (!force && inflight) return inflight;

  inflight = fetch("/api/chat/unread")
    .then((r) => (r.ok ? r.json() : { unreadTotal: 0 }))
    .then((d) => {
      cachedUnreadTotal = d.unreadTotal ?? 0;
      cachedAt = Date.now();
      return cachedUnreadTotal;
    })
    .catch(() => cachedUnreadTotal)
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function useChatUnread() {
  const [unreadTotal, setUnreadTotal] = useState(cachedUnreadTotal);

  useEffect(() => {
    let cancelled = false;

    const refresh = (force = false) => {
      fetchUnreadTotal(force).then((value) => {
        if (!cancelled) setUnreadTotal(value);
      });
    };

    refresh();
    const interval = setInterval(() => refresh(true), 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return unreadTotal;
}
