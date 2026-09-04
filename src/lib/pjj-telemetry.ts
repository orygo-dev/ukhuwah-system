import { z } from "zod";

export const PJJ_DIAGNOSTIC_EVENT_NAMES = [
  "connection.connect_attempt",
  "connection.connected",
  "connection.connect_failed",
  "connection.reconnecting",
  "connection.reconnected",
  "connection.disconnected",
  "connection.quality",
  "track.published",
  "track.publish_failed",
  "track.subscribed",
  "track.subscription_failed",
  "track.unsubscribed",
  "track.muted",
  "track.unmuted",
  "audio.playback_failed",
  "media.permission_denied",
  "media.devices.changed",
  "participant.count",
] as const;

export const pjjDiagnosticEventSchema = z.object({
  event: z.enum(PJJ_DIAGNOSTIC_EVENT_NAMES),
  occurredAt: z.string().datetime(),
  clientSessionId: z.string().uuid(),
  connectionState: z.string().max(32).optional(),
  quality: z.string().max(32).optional(),
  reason: z.string().max(96).optional(),
  trackSource: z.enum(["microphone", "camera", "screen_share", "unknown"]).optional(),
  participantCount: z.number().int().min(0).max(25).optional(),
  latencyMs: z.number().int().min(0).max(120_000).optional(),
});

export const pjjDiagnosticBatchSchema = z.object({
  events: z.array(pjjDiagnosticEventSchema).min(1).max(100),
});

export type PjjDiagnosticEvent = z.infer<typeof pjjDiagnosticEventSchema>;

const SECRET_PATTERN = /(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|api[_-]?secret|authorization|cookie|token)/i;

export function safeDiagnosticReason(value: unknown) {
  const text = typeof value === "string" ? value : value instanceof Error ? value.name : String(value ?? "unknown");
  return SECRET_PATTERN.test(text) ? "redacted" : text.slice(0, 96);
}

export function nextConnectionHealth(
  current: "connected" | "reconnecting" | "unstable" | "restored" | "disconnected",
  event: "reconnecting" | "reconnected" | "poor" | "good" | "disconnected"
) {
  if (event === "reconnecting") return "reconnecting" as const;
  if (event === "reconnected") return "restored" as const;
  if (event === "poor") return "unstable" as const;
  if (event === "disconnected") return "disconnected" as const;
  return current === "unstable" ? ("restored" as const) : current;
}
