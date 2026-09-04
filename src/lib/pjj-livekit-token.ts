import { AccessToken, RoomConfiguration } from "livekit-server-sdk";
import {
  canPublishMediaForJoin,
  effectiveLiveKitRoomCapacity,
  isPjjModeratorRole,
  liveKitPublishSourcesForRole,
  type PjjLiveRole,
  type PjjRoomMode,
} from "@/lib/livekit-policy";

export type PjjJoinTokenInput = {
  identity: string;
  name: string;
  roomName: string;
  role: PjjLiveRole;
  maxParticipants: number;
  roomMode?: PjjRoomMode;
  canPublishMedia?: boolean;
  metadata?: Record<string, unknown>;
};

export type PjjTokenServerConfig = {
  apiKey: string;
  apiSecret: string;
  wsUrl: string;
  maxParticipants: number;
};

export function liveClassParticipantRosterMutation(input: {
  sessionId: string;
  userId: string;
  studentId?: string | null;
  role: PjjLiveRole;
  roomMode?: PjjRoomMode;
  canPublishMedia?: boolean;
}) {
  const canPublishMedia =
    input.canPublishMedia ??
    canPublishMediaForJoin({
      role: input.role,
      roomMode: input.roomMode ?? "MEETING",
      canPublishMedia: false,
    });
  return {
    where: { sessionId_userId: { sessionId: input.sessionId, userId: input.userId } },
    create: {
      sessionId: input.sessionId,
      userId: input.userId,
      studentId: input.studentId || null,
      role: input.role,
      canPublishMedia,
    },
    update: {
      role: input.role,
      studentId: input.studentId || null,
      // Preserve promote flag on rejoin unless caller overrides.
      ...(input.canPublishMedia !== undefined ? { canPublishMedia: input.canPublishMedia } : {}),
    },
  };
}

export async function issuePjjJoinToken(
  input: PjjJoinTokenInput,
  config: PjjTokenServerConfig
) {
  const roomMode = input.roomMode ?? "MEETING";
  const canModerate = isPjjModeratorRole(input.role);
  const canPublish = canPublishMediaForJoin({
    role: input.role,
    roomMode,
    canPublishMedia: input.canPublishMedia,
  });
  const publishSources = liveKitPublishSourcesForRole(input.role, {
    roomMode,
    canPublishMedia: canPublish,
  });
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: input.identity,
    name: input.name,
    ttl: "2h",
    metadata: JSON.stringify({
      ...(input.metadata || {}),
      roomMode,
      canPublishMedia: canPublish,
    }),
  });
  const maxParticipants = effectiveLiveKitRoomCapacity(
    input.maxParticipants,
    config.maxParticipants,
    roomMode
  );
  token.roomConfig = new RoomConfiguration({ maxParticipants });
  token.addGrant({
    room: input.roomName,
    roomJoin: true,
    canPublish,
    canPublishSources: publishSources,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: canModerate,
  });
  return { token: await token.toJwt(), wsUrl: config.wsUrl, canPublishMedia: canPublish, roomMode };
}
