export type PjjPresence = "online" | "offline" | "connecting" | "reconnecting" | "unknown";

export type PjjRoomPeer = {
  identity: string;
  sid: string;
  isActive: boolean;
  connectionQuality?: string;
};

// Display-only evidence from the current room. Never use browser presence to
// write attendance or authorize a user; those remain server responsibilities.
export function roomAttendancePresence(connection: string, peer?: PjjRoomPeer): PjjPresence {
  if (connection === "reconnecting" || connection === "signalReconnecting") return "reconnecting";
  if (connection !== "connected") return "unknown";
  if (!peer) return "offline";
  if (peer.connectionQuality === "lost") return "reconnecting";
  return peer.isActive ? "online" : "connecting";
}

export const pjjPresenceLabel: Record<PjjPresence, string> = {
  online: "Online",
  offline: "Offline",
  connecting: "Menghubungkan",
  reconnecting: "Memulihkan koneksi",
  unknown: "Belum terverifikasi",
};
