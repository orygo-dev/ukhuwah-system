import {
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, maskSecret } from "@/lib/encryption";
import type { PjjLiveRole, PjjRoomMode } from "@/lib/livekit-policy";
import { issuePjjJoinToken } from "@/lib/pjj-livekit-token";
import {
  PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
} from "@/lib/pjj-capacity";

const LIVEKIT_SETTING_KEY = "integration.livekit";

type StoredLiveKitConfig = {
  enabled: boolean;
  provider: "SELF_HOSTED" | "CLOUD";
  wsUrl: string;
  apiUrl: string;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  recordingEnabled: boolean;
  maxParticipants: number;
  updatedById?: string;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastTestMessage?: string;
};

export type LiveKitPublicConfig = Omit<
  StoredLiveKitConfig,
  "apiKeyEncrypted" | "apiSecretEncrypted"
> & {
  configured: boolean;
  apiKeyMasked: string;
  apiSecretMasked: string;
  webhookUrl: string;
};

export type LiveKitConfigInput = {
  enabled: boolean;
  provider: "SELF_HOSTED" | "CLOUD";
  wsUrl: string;
  apiUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  recordingEnabled: boolean;
  maxParticipants: number;
};

function normalizeWsUrl(value: string) {
  return value.trim().replace(/\/$/, "");
}
function inferApiUrl(wsUrl: string) {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function webhookUrl() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/livekit/webhook`;
}

async function readStoredConfig(): Promise<StoredLiveKitConfig | null> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: LIVEKIT_SETTING_KEY },
    select: { value: true },
  });
  return setting ? (setting.value as StoredLiveKitConfig) : null;
}

export async function getLiveKitPublicConfig(): Promise<LiveKitPublicConfig> {
  const stored = await readStoredConfig();
  const envKey = process.env.LIVEKIT_API_KEY?.trim() || "";
  const envSecret = process.env.LIVEKIT_API_SECRET?.trim() || "";
  const envWsUrl = process.env.LIVEKIT_URL?.trim() || "";
  const configured = Boolean(
    (stored?.wsUrl && stored.apiKeyEncrypted && stored.apiSecretEncrypted) ||
      (envWsUrl && envKey && envSecret)
  );

  let apiKeyMasked = "";
  let apiSecretMasked = "";
  try {
    apiKeyMasked = stored?.apiKeyEncrypted
      ? maskSecret(decrypt(stored.apiKeyEncrypted))
      : envKey
        ? maskSecret(envKey)
        : "";
    apiSecretMasked = stored?.apiSecretEncrypted
      ? maskSecret(decrypt(stored.apiSecretEncrypted))
      : envSecret
        ? maskSecret(envSecret)
        : "";
  } catch {
    apiKeyMasked = "Tersimpan";
    apiSecretMasked = "Tersimpan";
  }

  const wsUrl = stored?.wsUrl || envWsUrl;
  return {
    enabled: stored?.enabled ?? Boolean(envWsUrl && envKey && envSecret),
    provider: stored?.provider ?? "SELF_HOSTED",
    wsUrl,
    apiUrl: stored?.apiUrl || (wsUrl ? inferApiUrl(wsUrl) : ""),
    recordingEnabled: stored?.recordingEnabled ?? false,
    maxParticipants: Math.min(
      stored?.maxParticipants ?? PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
      PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
    ),
    updatedById: stored?.updatedById,
    lastTestedAt: stored?.lastTestedAt,
    lastTestOk: stored?.lastTestOk,
    lastTestMessage: stored?.lastTestMessage,
    configured,
    apiKeyMasked,
    apiSecretMasked,
    webhookUrl: webhookUrl(),
  };
}

export async function saveLiveKitConfig(input: LiveKitConfigInput, userId: string) {
  const current = await readStoredConfig();
  const wsUrl = normalizeWsUrl(input.wsUrl);
  const apiKeyEncrypted = input.apiKey?.trim()
    ? encrypt(input.apiKey.trim())
    : current?.apiKeyEncrypted || "";
  const apiSecretEncrypted = input.apiSecret?.trim()
    ? encrypt(input.apiSecret.trim())
    : current?.apiSecretEncrypted || "";

  if (input.enabled && (!wsUrl || !apiKeyEncrypted || !apiSecretEncrypted)) {
    throw new Error("Lengkapi URL, API Key, dan API Secret sebelum mengaktifkan LiveKit.");
  }
  if (input.maxParticipants > PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS) {
    throw new Error(
      `Kapasitas aman PJJ maksimal ${PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS} peserta (classroom).`,
    );
  }

  const value: StoredLiveKitConfig = {
    enabled: input.enabled,
    provider: input.provider,
    wsUrl,
    apiUrl: (input.apiUrl?.trim() || inferApiUrl(wsUrl)).replace(/\/$/, ""),
    apiKeyEncrypted,
    apiSecretEncrypted,
    recordingEnabled: input.recordingEnabled,
    maxParticipants: input.maxParticipants,
    updatedById: userId,
    lastTestedAt: current?.lastTestedAt,
    lastTestOk: current?.lastTestOk,
    lastTestMessage: current?.lastTestMessage,
  };

  await prisma.platformSetting.upsert({
    where: { key: LIVEKIT_SETTING_KEY },
    create: { key: LIVEKIT_SETTING_KEY, value },
    update: { value },
  });
  return getLiveKitPublicConfig();
}

export async function getLiveKitServerConfig() {
  const stored = await readStoredConfig();
  const wsUrl = stored?.wsUrl || process.env.LIVEKIT_URL?.trim() || "";
  const apiKey = stored?.apiKeyEncrypted
    ? decrypt(stored.apiKeyEncrypted)
    : process.env.LIVEKIT_API_KEY?.trim() || "";
  const apiSecret = stored?.apiSecretEncrypted
    ? decrypt(stored.apiSecretEncrypted)
    : process.env.LIVEKIT_API_SECRET?.trim() || "";
  const enabled = stored?.enabled ?? Boolean(wsUrl && apiKey && apiSecret);
  const apiUrl = stored?.apiUrl || (wsUrl ? inferApiUrl(wsUrl) : "");

  if (!enabled || !wsUrl || !apiUrl || !apiKey || !apiSecret) {
    throw new Error("Integrasi LiveKit belum aktif atau belum lengkap.");
  }

  return {
    wsUrl,
    apiUrl,
    apiKey,
    apiSecret,
    maxParticipants: Math.min(
      stored?.maxParticipants ?? PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
      PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS,
    ),
    recordingEnabled: stored?.recordingEnabled ?? false,
  };
}

export async function testLiveKitConnection() {
  const config = await getLiveKitServerConfig();
  const service = new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret);
  const rooms = await service.listRooms();
  const message = `Terhubung ke LiveKit. ${rooms.length} ruang sedang tersedia.`;
  const current = await readStoredConfig();
  if (current) {
    await prisma.platformSetting.update({
      where: { key: LIVEKIT_SETTING_KEY },
      data: {
        value: {
          ...current,
          lastTestedAt: new Date().toISOString(),
          lastTestOk: true,
          lastTestMessage: message,
        },
      },
    });
  }
  return { ok: true, message };
}

export async function createLiveKitJoinToken(input: {
  identity: string;
  name: string;
  roomName: string;
  role: PjjLiveRole;
  maxParticipants: number;
  roomMode?: PjjRoomMode;
  canPublishMedia?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const config = await getLiveKitServerConfig();
  return issuePjjJoinToken(input, config);
}

export async function updateParticipantPublishPermission(input: {
  roomName: string;
  identity: string;
  canPublish: boolean;
  canModerate?: boolean;
}) {
  const service = await roomService();
  const sources = input.canPublish
    ? input.canModerate
      ? [
          TrackSource.CAMERA,
          TrackSource.MICROPHONE,
          TrackSource.SCREEN_SHARE,
          TrackSource.SCREEN_SHARE_AUDIO,
        ]
      : [TrackSource.CAMERA, TrackSource.MICROPHONE]
    : [];
  await service.updateParticipant(input.roomName, input.identity, {
    permission: {
      canPublish: input.canPublish,
      canPublishSources: sources,
      canSubscribe: true,
      canPublishData: true,
    },
  });
  return { canPublish: input.canPublish };
}

function roomService() {
  return getLiveKitServerConfig().then(
    (config) => new RoomServiceClient(config.apiUrl, config.apiKey, config.apiSecret)
  );
}

function isMicrophoneTrack(track: { source?: number | string; type?: number | string; name?: string }) {
  const source = String(track.source ?? "").toUpperCase();
  const type = String(track.type ?? "").toUpperCase();
  const name = String(track.name ?? "").toLowerCase();
  return (
    source.includes("MICROPHONE") ||
    source === "2" ||
    type.includes("AUDIO") ||
    name.includes("audio") ||
    name.includes("mic")
  );
}

export async function listLiveKitParticipants(roomName: string) {
  const service = await roomService();
  return service.listParticipants(roomName);
}

export async function muteParticipantMicrophone(
  roomName: string,
  identity: string,
  muted: boolean
) {
  const service = await roomService();
  const participants = await service.listParticipants(roomName);
  const participant = participants.find((item) => item.identity === identity);
  if (!participant) {
    throw new Error("Peserta tidak ditemukan di room live.");
  }
  const audioTracks = (participant.tracks || []).filter((track) => isMicrophoneTrack(track));
  if (audioTracks.length === 0) {
    throw new Error(muted ? "Peserta belum menyalakan mikrofon." : "Tidak ada track mikrofon.");
  }
  for (const track of audioTracks) {
    if (!track.sid) continue;
    await service.mutePublishedTrack(roomName, identity, track.sid, muted);
  }
  return { muted, trackCount: audioTracks.length };
}

export async function muteAllStudentMicrophones(
  roomName: string,
  hostIdentities: string[] = []
) {
  const service = await roomService();
  const participants = await service.listParticipants(roomName);
  const hostSet = new Set(hostIdentities);
  let mutedCount = 0;
  const mutedIdentities: string[] = [];
  for (const participant of participants) {
    if (hostSet.has(participant.identity)) continue;
    let metadataRole = "";
    try {
      metadataRole = JSON.parse(participant.metadata || "{}")?.role || "";
    } catch {
      metadataRole = "";
    }
    // Only mute explicit students; skip hosts/tutors and unknown roles.
    if (metadataRole !== "STUDENT") continue;
    const audioTracks = (participant.tracks || []).filter((track) => isMicrophoneTrack(track));
    for (const track of audioTracks) {
      if (!track.sid) continue;
      await service.mutePublishedTrack(roomName, participant.identity, track.sid, true);
      mutedCount += 1;
    }
    if (audioTracks.length > 0) mutedIdentities.push(participant.identity);
  }
  return { mutedCount, mutedIdentities };
}

export async function removeParticipantFromRoom(roomName: string, identity: string) {
  const service = await roomService();
  await service.removeParticipant(roomName, identity);
  return { removed: true };
}

export async function closeLiveKitRoom(roomName: string) {
  const service = await roomService();
  const rooms = await service.listRooms([roomName]);
  if (rooms.length === 0) return { closed: false };
  await service.deleteRoom(roomName);
  return { closed: true };
}

export async function publishServerRoomData(roomName: string, payload: Uint8Array, topic: string) {
  const service = await roomService();
  await service.sendData(roomName, payload, DataPacket_Kind.RELIABLE, { topic });
}

export async function getLiveKitWebhookReceiver() {
  const config = await getLiveKitServerConfig();
  return new WebhookReceiver(config.apiKey, config.apiSecret);
}

export async function receiveLiveKitWebhook(body: string, authorization?: string | null) {
  const receiver = await getLiveKitWebhookReceiver();
  return receiver.receive(body, authorization || undefined);
}
