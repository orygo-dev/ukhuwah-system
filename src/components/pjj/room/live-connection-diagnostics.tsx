"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionQuality, RoomEvent } from "livekit-client";
import {
  nextConnectionHealth,
  safeDiagnosticReason,
  type PjjDiagnosticEvent,
} from "@/lib/pjj-telemetry";

type Health = "connected" | "reconnecting" | "unstable" | "restored" | "disconnected";

export function LiveConnectionDiagnostics({
  liveSessionId,
  clientSessionId,
}: {
  liveSessionId: string;
  clientSessionId: string;
}) {
  const room = useRoomContext();
  const [health, setHealth] = useState<Health>("connected");
  const healthRef = useRef<Health>("connected");
  const queueRef = useRef<PjjDiagnosticEvent[]>([]);
  const restoredTimerRef = useRef<number | null>(null);
  const flushingRef = useRef(false);

  useEffect(() => {
    function enqueue(event: PjjDiagnosticEvent["event"], extra: Partial<PjjDiagnosticEvent> = {}) {
      queueRef.current.push({
        event,
        occurredAt: new Date().toISOString(),
        clientSessionId,
        connectionState: room.state,
        ...extra,
      });
      if (queueRef.current.length > 100) queueRef.current.splice(0, queueRef.current.length - 100);
    }

    function updateHealth(next: Health) {
      healthRef.current = next;
      setHealth(next);
    }

    async function flush(useBeacon = false) {
      if (queueRef.current.length === 0 || flushingRef.current) return;
      flushingRef.current = true;
      const events = queueRef.current.splice(0, 100);
      const body = JSON.stringify({ events });
      if (useBeacon && navigator.sendBeacon) {
        const accepted = navigator.sendBeacon(
          `/api/pjj/sessions/${liveSessionId}/diagnostics`,
          new Blob([body], { type: "application/json" })
        );
        if (!accepted) queueRef.current = [...events, ...queueRef.current].slice(0, 100);
        flushingRef.current = false;
        return;
      }
      try {
        const response = await fetch(`/api/pjj/sessions/${liveSessionId}/diagnostics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
        if (!response.ok) queueRef.current = [...events, ...queueRef.current].slice(0, 100);
      } catch {
        queueRef.current = [...events, ...queueRef.current].slice(0, 100);
      } finally {
        flushingRef.current = false;
      }
    }

    const showRestored = () => {
      updateHealth("restored");
      if (restoredTimerRef.current) window.clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = window.setTimeout(() => updateHealth("connected"), 4000);
    };
    const onReconnecting = () => {
      updateHealth(nextConnectionHealth(healthRef.current, "reconnecting"));
      enqueue("connection.reconnecting");
    };
    const onReconnected = () => {
      showRestored();
      enqueue("connection.reconnected");
    };
    const onDisconnected = (reason?: number) => {
      updateHealth(nextConnectionHealth(healthRef.current, "disconnected"));
      enqueue("connection.disconnected", { reason: safeDiagnosticReason(reason) });
      void flush(true);
    };
    const onQuality = (quality: ConnectionQuality, participant: { isLocal: boolean }) => {
      if (!participant.isLocal) return;
      enqueue("connection.quality", { quality: String(quality) });
      if (quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost) {
        updateHealth(nextConnectionHealth(healthRef.current, "poor"));
      } else if (healthRef.current === "unstable") {
        showRestored();
      }
    };
    const onTrackPublished = () => enqueue("track.published");
    const onTrackSubscribed = () => enqueue("track.subscribed");
    const onTrackUnsubscribed = () => enqueue("track.unsubscribed");
    const onTrackMuted = () => enqueue("track.muted");
    const onTrackUnmuted = () => enqueue("track.unmuted");
    const onDevicesChanged = () => enqueue("media.devices.changed");
    const onSubscriptionFailed = (_trackSid: string, _participant: unknown, reason?: unknown) =>
      enqueue("track.subscription_failed", { reason: safeDiagnosticReason(reason) });
    const onAudioPlayback = (playing: boolean) => {
      if (!playing) enqueue("audio.playback_failed", { reason: "autoplay_blocked" });
    };
    const onParticipantCount = () =>
      enqueue("participant.count", { participantCount: room.remoteParticipants.size + 1 });
    const onPageHide = () => void flush(true);

    enqueue("connection.connected", { participantCount: room.remoteParticipants.size + 1 });
    room
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.ConnectionQualityChanged, onQuality)
      .on(RoomEvent.TrackPublished, onTrackPublished)
      .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      .on(RoomEvent.TrackMuted, onTrackMuted)
      .on(RoomEvent.TrackUnmuted, onTrackUnmuted)
      .on(RoomEvent.MediaDevicesChanged, onDevicesChanged)
      .on(RoomEvent.TrackSubscriptionFailed, onSubscriptionFailed)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
      .on(RoomEvent.ParticipantConnected, onParticipantCount)
      .on(RoomEvent.ParticipantDisconnected, onParticipantCount);
    window.addEventListener("pagehide", onPageHide);
    const flushTimer = window.setInterval(() => void flush(), 3000);

    return () => {
      room
        .off(RoomEvent.Reconnecting, onReconnecting)
        .off(RoomEvent.Reconnected, onReconnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.ConnectionQualityChanged, onQuality)
        .off(RoomEvent.TrackPublished, onTrackPublished)
        .off(RoomEvent.TrackSubscribed, onTrackSubscribed)
        .off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
        .off(RoomEvent.TrackMuted, onTrackMuted)
        .off(RoomEvent.TrackUnmuted, onTrackUnmuted)
        .off(RoomEvent.MediaDevicesChanged, onDevicesChanged)
        .off(RoomEvent.TrackSubscriptionFailed, onSubscriptionFailed)
        .off(RoomEvent.AudioPlaybackStatusChanged, onAudioPlayback)
        .off(RoomEvent.ParticipantConnected, onParticipantCount)
        .off(RoomEvent.ParticipantDisconnected, onParticipantCount);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(flushTimer);
      if (restoredTimerRef.current) window.clearTimeout(restoredTimerRef.current);
      void flush(true);
    };
  }, [room, liveSessionId, clientSessionId]);

  if (health === "connected") return null;
  const label = {
    reconnecting: "Menghubungkan ulang...",
    unstable: "Jaringan tidak stabil",
    restored: "Koneksi pulih",
    disconnected: "Koneksi terputus",
  }[health];
  return (
    <div
      role="status"
      className={`border-b px-4 py-2 text-center text-xs font-bold ${
        health === "restored"
          ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-50"
          : "border-amber-400/30 bg-amber-400/15 text-amber-50"
      }`}
    >
      {label}
    </div>
  );
}
