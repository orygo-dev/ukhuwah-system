export type PjjPreviewDeviceKind = "audio" | "video";

export type PjjPreviewDeviceStatus =
  | "off"
  | "requesting"
  | "ready"
  | "denied"
  | "missing"
  | "busy"
  | "unsupported"
  | "error";

type PreviewTrack = { kind: string; stop: () => void };
type PreviewStream = {
  getAudioTracks: () => PreviewTrack[];
  getVideoTracks: () => PreviewTrack[];
};

export type PreviewMediaResult = {
  tracks: PreviewTrack[];
  audio: PjjPreviewDeviceStatus;
  video: PjjPreviewDeviceStatus;
};

export function classifyPreviewDeviceError(error: unknown): PjjPreviewDeviceStatus {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "missing";
  if (name === "NotReadableError" || name === "TrackStartError") return "busy";
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "unsupported";
  }
  return "error";
}

async function acquireKind(
  kind: PjjPreviewDeviceKind,
  enabled: boolean,
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<PreviewStream>
) {
  if (!enabled) return { status: "off" as const, tracks: [] as PreviewTrack[] };
  try {
    const stream = await getUserMedia(
      kind === "audio"
        ? { audio: true, video: false }
        : {
            audio: false,
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          }
    );
    const tracks = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
    return {
      status: tracks.length > 0 ? ("ready" as const) : ("missing" as const),
      tracks,
    };
  } catch (error) {
    return { status: classifyPreviewDeviceError(error), tracks: [] as PreviewTrack[] };
  }
}

export async function acquirePreviewMedia({
  audio,
  video,
  getUserMedia,
}: {
  audio: boolean;
  video: boolean;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<PreviewStream>;
}): Promise<PreviewMediaResult> {
  const [audioResult, videoResult] = await Promise.all([
    acquireKind("audio", audio, getUserMedia),
    acquireKind("video", video, getUserMedia),
  ]);
  return {
    tracks: [...audioResult.tracks, ...videoResult.tracks],
    audio: audioResult.status,
    video: videoResult.status,
  };
}

export function previewDeviceStatusLabel(
  kind: PjjPreviewDeviceKind,
  status: PjjPreviewDeviceStatus
) {
  const label = kind === "audio" ? "Mikrofon" : "Kamera";
  switch (status) {
    case "off":
      return `${label} mati`;
    case "requesting":
      return `Memeriksa ${label.toLowerCase()}`;
    case "ready":
      return `${label} siap`;
    case "denied":
      return `Izin ${label.toLowerCase()} ditolak`;
    case "missing":
      return `${label} tidak ditemukan`;
    case "busy":
      return `${label} sedang dipakai aplikasi lain`;
    case "unsupported":
      return `Pengaturan ${label.toLowerCase()} tidak didukung`;
    default:
      return `${label} gagal dibuka`;
  }
}
