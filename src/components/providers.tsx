"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { AppSplashScreen } from "@/components/app-splash-screen";
import { WebPushRegistration } from "@/components/notifications/web-push-registration";

const RELOAD_KEY = "gs_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 15_000;

function ChunkErrorRecovery() {
  useEffect(() => {
    function shouldReload(message: string, name?: string) {
      return (
        name === "ChunkLoadError" ||
        message.includes("Loading chunk") ||
        message.includes("ChunkLoadError") ||
        message.includes("Failed to fetch dynamically imported module")
      );
    }

    function tryReload(message: string, name?: string) {
      if (!shouldReload(message, name)) return;
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || "0");
      const now = Date.now();
      if (now - last < RELOAD_COOLDOWN_MS) return;
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }

    const onError = (event: ErrorEvent) => {
      tryReload(event.message, event.error?.name);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; name?: string } | undefined;
      tryReload(reason?.message || String(reason ?? ""), reason?.name);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <ChunkErrorRecovery />
      <WebPushRegistration />
      <AppSplashScreen />
      {children}
    </SessionProvider>
  );
}
