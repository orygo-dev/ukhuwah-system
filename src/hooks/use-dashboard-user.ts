"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type LatestAccount = {
  name?: string | null;
  creditsRemaining?: number | null;
};

export function useDashboardUser() {
  const { data: session } = useSession();
  const [latestAccount, setLatestAccount] = useState<LatestAccount | null>(null);
  const sessionUserId = session?.user?.id;

  useEffect(() => {
    if (!sessionUserId) {
      setLatestAccount(null);
      return;
    }

    let cancelled = false;
    fetch("/api/profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setLatestAccount(data?.account ?? null);
      })
      .catch(() => {
        if (!cancelled) setLatestAccount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  if (!session?.user) return undefined;
  return {
    name: latestAccount?.name || session.user.name || "Guru",
    email: session.user.email || "",
    role: session.user.role,
    credits: latestAccount?.creditsRemaining ?? session.user.creditsRemaining ?? 0,
  };
}
