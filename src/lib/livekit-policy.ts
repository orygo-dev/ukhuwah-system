import { TrackSource } from "livekit-server-sdk";
import {
  pjjSafeMaxForRoomMode,
  type PjjRoomMode,
} from "@/lib/pjj-capacity";

export {
  PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
  PJJ_SAFE_MEETING_MAX_PARTICIPANTS,
  pjjSafeMaxForRoomMode,
} from "@/lib/pjj-capacity";
export type { PjjRoomMode } from "@/lib/pjj-capacity";

export type PjjLiveRole = "TEACHER" | "STUDENT" | "TUTOR" | "MODERATOR";

export function isPjjModeratorRole(role: PjjLiveRole) {
  return role === "TEACHER" || role === "TUTOR" || role === "MODERATOR";
}

export function liveKitPublishSourcesForRole(
  role: PjjLiveRole,
  options?: { roomMode?: PjjRoomMode; canPublishMedia?: boolean }
): TrackSource[] {
  if (isPjjModeratorRole(role)) {
    return [
      TrackSource.CAMERA,
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ];
  }
  const roomMode = options?.roomMode ?? "MEETING";
  if (roomMode === "CLASSROOM" && !options?.canPublishMedia) {
    return [];
  }
  return [TrackSource.CAMERA, TrackSource.MICROPHONE];
}

export function canPublishMediaForJoin(input: {
  role: PjjLiveRole;
  roomMode: PjjRoomMode;
  canPublishMedia?: boolean;
}) {
  if (isPjjModeratorRole(input.role)) return true;
  if (input.roomMode === "MEETING") return true;
  return Boolean(input.canPublishMedia);
}

export function effectiveLiveKitRoomCapacity(
  sessionMaximum: number,
  platformMaximum: number,
  roomMode: PjjRoomMode = "MEETING"
) {
  return Math.max(
    2,
    Math.min(sessionMaximum, platformMaximum, pjjSafeMaxForRoomMode(roomMode))
  );
}

export function pjjCapacityDecision(
  requested: number,
  platformMaximum: number,
  roomMode: PjjRoomMode = "MEETING"
) {
  const maximum = effectiveLiveKitRoomCapacity(platformMaximum, platformMaximum, roomMode);
  return { allowed: requested >= 2 && requested <= maximum, maximum };
}
