"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { syncWebPush } from "@/lib/firebase-web-push";

export function WebPushRegistration() {
  const { status } = useSession();
  const lastAttemptAt = useRef<number>(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncing = useRef<boolean>(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const attempt = async (retry = 0) => {
      if (syncing.current) return;
      const now = Date.now();
      const minGapMs = 5_000;
      if (retry === 0 && now - lastAttemptAt.current < minGapMs) return;
      lastAttemptAt.current = now;
      syncing.current = true;
      try {
        const result = await syncWebPush(false);
        if (result === "NOT_CONFIGURED" && retry < 4) {
          retryTimer.current = setTimeout(() => void attempt(retry + 1), 2_500 * (retry + 1));
        }
      } catch (error) {
        if (retry < 3) {
          retryTimer.current = setTimeout(() => void attempt(retry + 1), 2_500 * (retry + 1));
        } else {
          console.error("[web push registration] failed after retries:", error);
        }
      } finally {
        syncing.current = false;
      }
    };

    void attempt(0);

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission === "granted") void attempt(0);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [status]);

  return null;
}
