import type { PjjWhiteboardStroke } from "@/lib/pjj-whiteboard-state";

export type RoomDataMessage =
  | {
      type: "wb:stroke";
      stroke: PjjWhiteboardStroke;
    }
  | { type: "wb:clear"; by: string }
  | {
      type: "wb:persisted";
      sequence: number;
      action: { kind: "stroke"; stroke: PjjWhiteboardStroke } | { kind: "clear" };
    }
  | { type: "q:new"; questionId: string }
  | { type: "q:update"; questionId: string; status: string }
  | { type: "att:refresh" }
  | {
      type: "chat:message";
      id: string;
      body: string;
      senderName: string;
      senderIdentity: string;
      createdAt: string;
    }
  | {
      type: "chat:persisted";
      id: string;
      body: string;
      senderName: string;
      senderIdentity: string;
      createdAt: string;
    }
  | { type: "mod:request_unmute"; targetIdentity: string; byName: string }
  | { type: "mod:muted"; targetIdentity: string }
  | {
      type: "participant:publish";
      targetIdentity: string;
      canPublishMedia: boolean;
    }
  | { type: "quiz:launch"; quizId: string }
  | { type: "quiz:close"; quizId: string }
  | { type: "quiz:update"; quizId: string };

export type RoomDataParticipant = {
  identity: string;
  name?: string;
  metadata?: string;
};

const MODERATOR_ROLES = new Set(["TEACHER", "TUTOR", "MODERATOR"]);

export function roomParticipantRole(participant?: RoomDataParticipant): string | null {
  if (!participant?.metadata) return null;
  try {
    const value = JSON.parse(participant.metadata) as { role?: unknown };
    return typeof value.role === "string" ? value.role : null;
  } catch {
    return null;
  }
}

export function isRoomModerator(participant?: RoomDataParticipant) {
  const role = roomParticipantRole(participant);
  return Boolean(role && MODERATOR_ROLES.has(role));
}

const MODERATOR_ONLY_TYPES = new Set<RoomDataMessage["type"]>([
  "wb:clear",
  "q:update",
  "att:refresh",
  "mod:request_unmute",
  "mod:muted",
  "participant:publish",
  "quiz:launch",
  "quiz:close",
  "quiz:update",
]);

export function isAuthorizedRoomDataMessage(
  message: RoomDataMessage | null,
  participant?: RoomDataParticipant
): message is RoomDataMessage {
  if (!message) return false;
  if (message.type === "chat:persisted") return participant === undefined;
  if (message.type === "wb:persisted") return participant === undefined;
  // Legacy client chat contains spoofable identity/name fields. It remains
  // decodable for protocol compatibility but is never authoritative.
  if (message.type === "chat:message") return false;
  if (MODERATOR_ONLY_TYPES.has(message.type)) return isRoomModerator(participant);
  // Stroke and question invalidation packets must originate from an actual
  // room participant, not an anonymous/server-shaped forged event.
  return participant !== undefined;
}

export function isTrustedPersistedChat(
  message: RoomDataMessage | null,
  participant?: RoomDataParticipant
): message is Extract<RoomDataMessage, { type: "chat:persisted" }> {
  // RoomService.SendData is delivered without a participant. Any participant
  // attached to the event means the packet originated from an untrusted client.
  return message?.type === "chat:persisted" && isAuthorizedRoomDataMessage(message, participant);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isShortString(value: unknown, max: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isStroke(value: unknown): value is Extract<RoomDataMessage, { type: "wb:stroke" }>["stroke"] {
  if (!isRecord(value)) return false;
  if (
    !isShortString(value.id, 200) ||
    !isShortString(value.color, 32) ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width < 1 ||
    value.width > 50 ||
    typeof value.erase !== "boolean" ||
    !Array.isArray(value.points) ||
    value.points.length < 2 ||
    value.points.length > 200
  ) {
    return false;
  }
  return value.points.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      point.every(
        (coordinate) =>
          typeof coordinate === "number" &&
          Number.isFinite(coordinate) &&
          coordinate >= 0 &&
          coordinate <= 1
      )
  );
}

function isRoomDataMessage(value: unknown): value is RoomDataMessage {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  switch (value.type) {
    case "wb:stroke":
      return isStroke(value.stroke);
    case "wb:clear":
      return isShortString(value.by, 200);
    case "wb:persisted":
      return (
        typeof value.sequence === "number" &&
        Number.isInteger(value.sequence) &&
        value.sequence > 0 &&
        isRecord(value.action) &&
        (value.action.kind === "clear" ||
          (value.action.kind === "stroke" && isStroke(value.action.stroke)))
      );
    case "q:new":
      return isShortString(value.questionId, 200);
    case "q:update":
      return isShortString(value.questionId, 200) && isShortString(value.status, 32);
    case "att:refresh":
      return true;
    case "chat:message":
    case "chat:persisted":
      return (
        isShortString(value.id, 200) &&
        isShortString(value.body, 500) &&
        isShortString(value.senderName, 200) &&
        isShortString(value.senderIdentity, 200) &&
        isShortString(value.createdAt, 64) &&
        !Number.isNaN(Date.parse(value.createdAt))
      );
    case "mod:request_unmute":
      return isShortString(value.targetIdentity, 200) && isShortString(value.byName, 200);
    case "mod:muted":
      return isShortString(value.targetIdentity, 200);
    case "participant:publish":
      return (
        isShortString(value.targetIdentity, 200) &&
        typeof value.canPublishMedia === "boolean"
      );
    case "quiz:launch":
    case "quiz:close":
    case "quiz:update":
      return isShortString(value.quizId, 200);
    default:
      return false;
  }
}

export function encodeRoomData(message: RoomDataMessage): Uint8Array<ArrayBuffer> {
  const bytes = new TextEncoder().encode(JSON.stringify(message));
  // LiveKit publishData expects Uint8Array backed by ArrayBuffer (not SharedArrayBuffer).
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function decodeRoomData(payload: Uint8Array): RoomDataMessage | null {
  // Reliable data packets have a 15 KiB application payload budget. Rejecting
  // larger input early also protects JSON parsing and UI reducers.
  if (payload.byteLength > 15 * 1024) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
    return isRoomDataMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "PARTIAL",
  "ABSENT",
  "NEEDS_REVIEW",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function attendanceLabel(status: string) {
  switch (status) {
    case "PRESENT":
      return "Hadir";
    case "LATE":
      return "Terlambat";
    case "PARTIAL":
      return "Sebagian";
    case "ABSENT":
      return "Tidak hadir";
    case "NEEDS_REVIEW":
      return "Perlu tinjau";
    default:
      return status;
  }
}

export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} dtk`;
  return `${minutes} mnt`;
}
