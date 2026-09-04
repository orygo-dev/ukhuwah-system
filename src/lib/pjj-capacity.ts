// Meeting mode keeps the verified all-publish profile.
// Classroom mode raises join capacity with limited publishers (spectators + promote).
export const PJJ_SAFE_MEETING_MAX_PARTICIPANTS = 25;
export const PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS = 100;

export type PjjRoomMode = "MEETING" | "CLASSROOM";

export function pjjSafeMaxForRoomMode(roomMode: PjjRoomMode = "MEETING") {
  return roomMode === "CLASSROOM"
    ? PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS
    : PJJ_SAFE_MEETING_MAX_PARTICIPANTS;
}
