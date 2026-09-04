"use client";

import { useEffect } from "react";
import { startVisiblePresencePolling } from "@/lib/presence-polling";

export function StudentPresenceHeartbeat() {
  useEffect(() => startVisiblePresencePolling(async (signal) => {
    const response = await fetch("/api/student-presence/heartbeat", {
      method: "POST", credentials: "same-origin", cache: "no-store", signal,
    });
    return response.status !== 401 && response.status !== 403;
  }), []);
  return null;
}
