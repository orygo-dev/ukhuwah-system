"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ConnectionStateToast,
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  isTrackReference,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { MediaDeviceFailure, RoomEvent, Track, type LocalParticipant, type Participant } from "livekit-client";
import {
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  Hand,
  Loader2,
  MessageSquare,
  PenLine,
  RadioTower,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LiveAttendancePanel } from "@/components/pjj/room/live-attendance-panel";
import { LiveChatPanel } from "@/components/pjj/room/live-chat-panel";
import { LiveJoinLobby, type JoinPreferences } from "@/components/pjj/room/live-join-lobby";
import { LiveParticipantsPanel } from "@/components/pjj/room/live-participants-panel";
import { LiveQuestionsPanel } from "@/components/pjj/room/live-questions-panel";
import { LiveQuizPanel, LiveStudentQuizOverlay } from "@/components/pjj/room/live-quiz-panel";
import { decodeRoomData } from "@/components/pjj/room/live-room-data";
import { LiveWhiteboardPanel } from "@/components/pjj/room/live-whiteboard-panel";
import { PJJ_CONTROL_BAR_CONTROLS } from "@/lib/pjj-conference-controls";
import { readResponseJson } from "@/lib/http-json";

type Credentials = {
  token: string;
  wsUrl: string;
  roomName: string;
};

type StudentQuiz = {
  id: string;
  title: string;
  durationSec: number;
  launchedAt?: string | null;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    points: number;
  }>;
  myAttempt?: { status: string; score: number } | null;
};

type RoomTab =
  | "video"
  | "participants"
  | "attendance"
  | "board"
  | "questions"
  | "quiz"
  | "chat";

function isMediaDeviceError(message: string) {
  return /videoinput|audioinput|permission|NotAllowed|NotFound|NotReadable|Overconstrained|getUserMedia|device|camera|microphone|Could not start|Starting video|Starting audio/i.test(
    message
  );
}

function ModerationBanners({
  hostMutedNotice,
  unmuteRequest,
  onClearUnmute,
  onEnableMic,
}: {
  hostMutedNotice: string | null;
  unmuteRequest: string | null;
  onClearUnmute: () => void;
  onEnableMic: () => void;
}) {
  if (!hostMutedNotice && !unmuteRequest) return null;
  return (
    <div className="space-y-2 border-b border-white/10 bg-slate-900 px-3 py-2 sm:px-4">
      {hostMutedNotice ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
          {hostMutedNotice}
        </p>
      ) : null}
      {unmuteRequest ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-50">
          <span>{unmuteRequest}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={onEnableMic}>
              Nyalakan mic
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClearUnmute}>
              Tutup
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function participantRole(participant: Participant | undefined) {
  if (!participant) return "STUDENT";
  try {
    const meta = JSON.parse(participant.metadata || "{}") as { role?: string };
    return meta.role || "STUDENT";
  } catch {
    return "STUDENT";
  }
}

function isHostParticipant(participant: Participant | undefined) {
  return participantRole(participant) !== "STUDENT";
}

function trackIdentityKey(track: TrackReferenceOrPlaceholder) {
  const sid = isTrackReference(track) ? track.publication.trackSid : "placeholder";
  return `${track.participant.identity}-${track.source}-${sid}`;
}

function friendlyMediaDeviceMessage(kind: string, error: Error) {
  const failure = MediaDeviceFailure.getFailure(error);
  if (failure === MediaDeviceFailure.DeviceInUse) {
    return `${kind} masih terkunci oleh proses lain (sering di Windows). Tutup Zoom/Teams/tab lain yang memakai kamera, lalu coba lagi.`;
  }
  if (failure === MediaDeviceFailure.PermissionDenied) {
    return `Izin ${kind.toLowerCase()} ditolak browser. Izinkan akses untuk situs ini, lalu refresh.`;
  }
  if (failure === MediaDeviceFailure.NotFound) {
    return `${kind} tidak ditemukan. Periksa perangkat tersambung.`;
  }
  const raw = error.message || "gagal mengaktifkan perangkat";
  if (/Starting videoinput failed|Could not start video source|NotReadableError/i.test(raw)) {
    return `${kind} gagal dinyalakan ulang. Lepas kunci kamera (tutup app lain), lalu tekan ON lagi.`;
  }
  return `${kind} gagal diaktifkan: ${raw}`;
}

/** Fully release a muted camera so the next ON can open a fresh MediaStream (Windows-safe). */
async function releaseLocalCameraTrack(localParticipant: LocalParticipant) {
  const publication = localParticipant.getTrackPublication(Track.Source.Camera);
  const mediaTrack = publication?.track;
  if (!mediaTrack) return;
  try {
    await localParticipant.unpublishTrack(mediaTrack, true);
  } catch {
    // ignore — track may already be gone
  }
}

async function forceEnableCamera(localParticipant: LocalParticipant) {
  await releaseLocalCameraTrack(localParticipant);
  await new Promise((resolve) => window.setTimeout(resolve, 350));
  await localParticipant.setCameraEnabled(true);
}

function hasUsableCameraPublication(track: TrackReferenceOrPlaceholder) {
  if (!isTrackReference(track)) return false;
  // Camera mute stops the MediaStreamTrack but keeps the LocalTrack publication.
  // Keep the tile so unmute/restart can reattach without the stage falling back
  // to "Menunggu kamera guru..." with a stale empty layout.
  if (track.source === Track.Source.Camera) {
    return Boolean(track.publication);
  }
  return Boolean(track.publication.track);
}

function pickClassroomLayout(
  tracks: TrackReferenceOrPlaceholder[],
  roomMode: "MEETING" | "CLASSROOM" = "MEETING"
) {
  const published =
    roomMode === "CLASSROOM"
      ? tracks.filter((track) => {
          if (track.source === Track.Source.ScreenShare) {
            return isTrackReference(track) && Boolean(track.publication.track);
          }
          if (track.source !== Track.Source.Camera) return false;
          return hasUsableCameraPublication(track);
        })
      : tracks;

  const screenShare = published.find(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      isTrackReference(track) &&
      Boolean(track.publication.track)
  );
  const cameras = published.filter((track) => track.source === Track.Source.Camera);
  const hostCamera =
    cameras.find((track) => isHostParticipant(track.participant)) || cameras[0];
  const stageTrack = screenShare || hostCamera || published[0];

  if (!stageTrack) {
    return {
      stageTrack: undefined as TrackReferenceOrPlaceholder | undefined,
      stripTracks: [] as TrackReferenceOrPlaceholder[],
    };
  }

  const stripTracks = published.filter((track) => {
    if (track === stageTrack) return false;
    if (stageTrack.source === Track.Source.ScreenShare) {
      return track.source === Track.Source.Camera;
    }
    return (
      track.source === Track.Source.Camera &&
      track.participant.identity !== stageTrack.participant.identity
    );
  });

  return { stageTrack, stripTracks };
}

function PjjVideoConference({
  roomMode = "MEETING",
  onDeviceError,
}: {
  roomMode?: "MEETING" | "CLASSROOM";
  onDeviceError?: (message: string | null) => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const recoveringCameraRef = useRef(false);
  const tracks = useTracks(
    [
      // Meeting keeps placeholders; classroom only shows real camera pubs
      // (including muted ones — see hasUsableCameraPublication).
      { source: Track.Source.Camera, withPlaceholder: roomMode === "MEETING" },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      // ActiveSpeakersChanged alone is not enough: camera OFF uses mute() which
      // stops the MediaStreamTrack, and ON calls restart()/unmute without
      // publish events. Without mute/unmute here the stage layout goes stale.
      updateOnlyOn: [
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.TrackStreamStateChanged,
      ],
      onlySubscribed: false,
    }
  );

  // After ControlBar mutes the camera, unpublish so Windows releases the device.
  // Next ON then creates a fresh track instead of failing restartTrack().
  useEffect(() => {
    const onTrackMuted = (publication: { source: Track.Source; track?: { kind: string } | null }, participant: Participant) => {
      if (!participant.isLocal) return;
      if (publication.source !== Track.Source.Camera) return;
      void releaseLocalCameraTrack(localParticipant);
    };
    room.on(RoomEvent.TrackMuted, onTrackMuted);
    return () => {
      room.off(RoomEvent.TrackMuted, onTrackMuted);
    };
  }, [room, localParticipant]);

  const { stageTrack, stripTracks } = useMemo(
    () => pickClassroomLayout(tracks, roomMode),
    [tracks, roomMode]
  );
  const stageLabel =
    stageTrack?.source === Track.Source.ScreenShare
      ? "Layar dibagikan"
      : isHostParticipant(stageTrack?.participant)
        ? "Guru"
        : stageTrack?.participant.name || "Peserta";

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
        <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
          {stageTrack ? (
            <ParticipantTile
              trackRef={stageTrack}
              className="!h-full !w-full max-h-full max-w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
            />
          ) : (
            <div className="grid h-full place-items-center px-4 text-center text-sm text-slate-400">
              Menunggu kamera guru...
            </div>
          )}
          {stageTrack ? (
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              {stageLabel}
            </div>
          ) : null}
        </div>
      </div>

      {stripTracks.length > 0 ? (
        <div className="shrink-0 border-t border-white/10 px-2 py-2 sm:px-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {stripTracks.map((track) => (
              <div
                key={trackIdentityKey(track)}
                className="relative h-[84px] w-[126px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900 sm:h-[96px] sm:w-[144px]"
              >
                <ParticipantTile
                  trackRef={track}
                  className="!h-full !w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-white/10">
        <ControlBar
          controls={PJJ_CONTROL_BAR_CONTROLS}
          onDeviceError={({ source, error }) => {
            const kind =
              source === Track.Source.Camera
                ? "Kamera"
                : source === Track.Source.Microphone
                  ? "Mikrofon"
                  : "Perangkat";
            if (source === Track.Source.Camera && !recoveringCameraRef.current) {
              recoveringCameraRef.current = true;
              void (async () => {
                try {
                  await forceEnableCamera(localParticipant);
                  onDeviceError?.(null);
                } catch (retryError) {
                  const err =
                    retryError instanceof Error
                      ? retryError
                      : error instanceof Error
                        ? error
                        : new Error(String(retryError ?? error));
                  onDeviceError?.(friendlyMediaDeviceMessage(kind, err));
                } finally {
                  recoveringCameraRef.current = false;
                }
              })();
              return;
            }
            const err = error instanceof Error ? error : new Error(String(error ?? "unknown"));
            onDeviceError?.(friendlyMediaDeviceMessage(kind, err));
          }}
        />
      </div>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  );
}

function RoomHeaderMeta({
  title,
  className,
  role,
  backHref,
  activeTab,
  onTabChange,
  openQuestions,
  unreadChat,
}: {
  title: string;
  className: string;
  role: string;
  backHref: string;
  activeTab: RoomTab;
  onTabChange: (tab: RoomTab) => void;
  openQuestions: number;
  unreadChat: number;
}) {
  const participants = useParticipants();
  const room = useRoomContext();
  const isModerator = role !== "STUDENT";

  const tabs: Array<{ id: RoomTab; label: string; icon: ReactNode; badge?: number }> = [
    { id: "video", label: "Video", icon: <Video className="h-3.5 w-3.5" /> },
    { id: "participants", label: "Peserta", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "attendance", label: "Absensi", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
    { id: "board", label: "Papan", icon: <PenLine className="h-3.5 w-3.5" /> },
    {
      id: "questions",
      label: "Tanya",
      icon: <Hand className="h-3.5 w-3.5" />,
      badge: openQuestions,
    },
    { id: "quiz", label: "Kuis", icon: <ClipboardList className="h-3.5 w-3.5" /> },
    {
      id: "chat",
      label: "Chat",
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      badge: unreadChat,
    },
  ];

  return (
    <header className="border-b border-white/10 bg-slate-950 px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
          >
            <Link href={backHref} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate font-black text-white">{title}</p>
            <p className="truncate text-xs text-slate-400">{className}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/20">
            {room.state === "connected" ? "LIVE" : room.state}
          </Badge>
          <Badge variant="outline" className="border-white/20 text-slate-200">
            <Users className="mr-1 h-3.5 w-3.5" />
            {participants.length}
          </Badge>
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isModerator ? "Moderator" : "Siswa"}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Button
              key={tab.id}
              type="button"
              size="sm"
              variant="outline"
              className={`border-white/15 text-xs shadow-none ${
                active
                  ? "border-white/30 bg-white/20 text-white hover:bg-white/25 hover:text-white"
                  : "bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {typeof tab.badge === "number" && tab.badge > 0 ? (
                <span className="ml-1 rounded-full bg-cyan-400/20 px-1.5 text-[10px] text-cyan-100">
                  {tab.badge}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>
    </header>
  );
}

function ConnectedRoom({
  liveSessionId,
  title,
  className,
  role,
  backHref,
  roomMode,
  canPublishMedia,
}: {
  liveSessionId: string;
  title: string;
  className: string;
  role: string;
  backHref: string;
  roomMode: "MEETING" | "CLASSROOM";
  canPublishMedia: boolean;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const isModerator = role !== "STUDENT";
  const [activeTab, setActiveTab] = useState<RoomTab>("video");
  const [openQuestions, setOpenQuestions] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);
  const [hostMutedNotice, setHostMutedNotice] = useState<string | null>(null);
  const [unmuteRequest, setUnmuteRequest] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [localCanPublish, setLocalCanPublish] = useState(canPublishMedia);
  const [studentQuiz, setStudentQuiz] = useState<StudentQuiz | null>(null);
  const [showStudentQuiz, setShowStudentQuiz] = useState(false);
  const identity = useMemo(() => `user-${role}-${liveSessionId.slice(-6)}`, [liveSessionId, role]);

  useEffect(() => {
    setLocalCanPublish(canPublishMedia);
  }, [canPublishMedia]);

  const refreshActiveQuiz = useCallback(async () => {
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/quizzes`, {
        cache: "no-store",
      });
      const data = await readResponseJson<{ activeQuiz?: StudentQuiz | null }>(response);
      if (!response.ok) return;
      const active = data.activeQuiz || null;
      setStudentQuiz(active);
      if (!isModerator && active) {
        setShowStudentQuiz(true);
      }
      if (!active) setShowStudentQuiz(false);
    } catch {
      // ignore
    }
  }, [liveSessionId, isModerator]);

  useEffect(() => {
    void refreshActiveQuiz();
  }, [refreshActiveQuiz]);

  useEffect(() => {
    if (roomMode !== "CLASSROOM" || isModerator || localCanPublish) return;
    void localParticipant.setCameraEnabled(false);
    void localParticipant.setMicrophoneEnabled(false);
  }, [roomMode, isModerator, localCanPublish, localParticipant]);

  useEffect(() => {
    let cancelled = false;
    async function loadOpenCount() {
      try {
        const response = await fetch(`/api/pjj/sessions/${liveSessionId}/questions`, {
          cache: "no-store",
        });
        const data = await readResponseJson<{ openCount?: number }>(response);
        if (!cancelled && response.ok) setOpenQuestions(data.openCount || 0);
      } catch {
        // ignore badge failures
      }
    }
    void loadOpenCount();
    const timer = window.setInterval(() => void loadOpenCount(), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveSessionId]);

  useEffect(() => {
    const onData = (payload: Uint8Array) => {
      const message = decodeRoomData(payload);
      if (!message) return;
      if (message.type === "mod:muted" && message.targetIdentity === localParticipant.identity) {
        setHostMutedNotice("Mikrofon Anda dimatikan oleh host.");
      }
      if (
        message.type === "mod:request_unmute" &&
        message.targetIdentity === localParticipant.identity
      ) {
        setUnmuteRequest(`${message.byName} meminta Anda menyalakan mikrofon.`);
      }
      if (
        message.type === "participant:publish" &&
        message.targetIdentity === localParticipant.identity
      ) {
        setLocalCanPublish(Boolean(message.canPublishMedia));
        if (!message.canPublishMedia) {
          void localParticipant.setCameraEnabled(false);
          void localParticipant.setMicrophoneEnabled(false);
          setHostMutedNotice("Hak kamera/mikrofon Anda dicabut oleh host.");
        } else {
          setHostMutedNotice("Host mengizinkan Anda menyalakan kamera/mikrofon.");
        }
      }
      if (
        message.type === "quiz:launch" ||
        message.type === "quiz:close" ||
        message.type === "quiz:update"
      ) {
        void refreshActiveQuiz();
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, localParticipant, refreshActiveQuiz]);

  function handleTabChange(tab: RoomTab) {
    setActiveTab(tab);
    if (tab === "chat") setUnreadChat(0);
  }

  const showSidePanel = activeTab !== "video";

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-slate-950 text-white" data-lk-theme="default">
      <RoomHeaderMeta
        title={title}
        className={className}
        role={role}
        backHref={backHref}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        openQuestions={openQuestions}
        unreadChat={unreadChat}
      />
      <ModerationBanners
        hostMutedNotice={deviceError || hostMutedNotice}
        unmuteRequest={unmuteRequest}
        onClearUnmute={() => setUnmuteRequest(null)}
        onEnableMic={() => {
          if (roomMode === "CLASSROOM" && !isModerator && !localCanPublish) {
            setHostMutedNotice("Anda belum dipromote untuk menyalakan mikrofon.");
            return;
          }
          void localParticipant.setMicrophoneEnabled(true).catch((error) => {
            setDeviceError(
              error instanceof Error
                ? `Mikrofon gagal diaktifkan: ${error.message}`
                : "Mikrofon gagal diaktifkan."
            );
          });
          setUnmuteRequest(null);
          setHostMutedNotice(null);
        }}
      />

      <div
        className={`min-h-0 flex-1 ${
          showSidePanel
            ? "grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            : "flex"
        }`}
      >
        <section
          className={`min-h-0 border-white/10 ${
            showSidePanel
              ? "hidden lg:flex lg:min-h-0 lg:flex-col lg:border-r"
              : "flex min-h-0 flex-1 flex-col"
          }`}
        >
          <PjjVideoConference
            roomMode={roomMode}
            onDeviceError={(message) => {
              setDeviceError(message);
              setHostMutedNotice(null);
            }}
          />
        </section>

        {showSidePanel ? (
          <aside className="flex min-h-0 flex-col overflow-hidden p-3 sm:p-4">
            {activeTab === "participants" ? (
              <LiveParticipantsPanel
                liveSessionId={liveSessionId}
                isModerator={isModerator}
                roomMode={roomMode}
              />
            ) : null}
            {activeTab === "attendance" ? <LiveAttendancePanel liveSessionId={liveSessionId} /> : null}
            {activeTab === "board" ? (
              <LiveWhiteboardPanel
                liveSessionId={liveSessionId}
                canClear={isModerator}
                identity={identity}
              />
            ) : null}
            {activeTab === "questions" ? (
              <LiveQuestionsPanel
                liveSessionId={liveSessionId}
                isModerator={isModerator}
                onOpenCountChange={setOpenQuestions}
              />
            ) : null}
            {activeTab === "quiz" ? (
              <LiveQuizPanel liveSessionId={liveSessionId} isModerator={isModerator} />
            ) : null}
            <div className={activeTab === "chat" ? "flex h-full min-h-0 flex-col" : "hidden"}>
              <LiveChatPanel
                liveSessionId={liveSessionId}
                active={activeTab === "chat"}
                onUnreadIncrement={() => setUnreadChat((count) => count + 1)}
              />
            </div>
          </aside>
        ) : null}
      </div>
      {!isModerator && showStudentQuiz ? (
        <LiveStudentQuizOverlay
          liveSessionId={liveSessionId}
          activeQuiz={studentQuiz}
          onDismissed={() => setShowStudentQuiz(false)}
        />
      ) : null}
    </div>
  );
}

export function LiveClassRoomClient({
  liveSessionId,
  title,
  className,
  role,
  backHref,
}: {
  liveSessionId: string;
  title: string;
  className: string;
  role: string;
  backHref: string;
}) {
  const [phase, setPhase] = useState<"lobby" | "joining" | "live">("lobby");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);
  const [enableAudio, setEnableAudio] = useState(true);
  const [enableVideo, setEnableVideo] = useState(false);
  const [roomMode, setRoomMode] = useState<"MEETING" | "CLASSROOM">("MEETING");
  const [canPublishMedia, setCanPublishMedia] = useState(role !== "STUDENT");
  const ignoreDisconnectRef = useRef(false);

  async function joinWithPrefs(prefs: JoinPreferences) {
    setPhase("joining");
    setLobbyError(null);
    setFatalError(null);
    try {
      const response = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveSessionId }),
      });
      const data = await readResponseJson<
        Credentials & {
          roomMode?: "MEETING" | "CLASSROOM";
          canPublishMedia?: boolean;
        }
      >(response);
      if (!response.ok) throw new Error(data.error || "Gagal masuk kelas.");
      const nextRoomMode =
        data.roomMode === "CLASSROOM" ? "CLASSROOM" : "MEETING";
      const nextCanPublish = Boolean(
        data.canPublishMedia ?? (role !== "STUDENT" || nextRoomMode === "MEETING")
      );
      setRoomMode(nextRoomMode);
      setCanPublishMedia(nextCanPublish);
      setEnableAudio(nextCanPublish ? prefs.audio : false);
      setEnableVideo(nextCanPublish ? prefs.video : false);
      setCredentials(data);
      setPhase("live");
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : "Gagal masuk kelas.");
      setPhase("lobby");
    }
  }

  if (phase === "lobby" || phase === "joining") {
    return (
      <LiveJoinLobby
        title={title}
        className={className}
        role={role}
        backHref={backHref}
        joining={phase === "joining"}
        error={lobbyError}
        onJoin={(prefs) => void joinWithPrefs(prefs)}
      />
    );
  }

  if (fatalError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-white">
        <div className="w-full max-w-lg rounded-[28px] border border-red-400/20 bg-white/10 p-8 text-center backdrop-blur">
          <RadioTower className="mx-auto h-10 w-10 text-red-300" />
          <h1 className="mt-4 text-xl font-black">Tidak dapat masuk kelas</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{fatalError}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setFatalError(null);
                setCredentials(null);
                setPhase("lobby");
              }}
            >
              Kembali ke lobby
            </Button>
            <Button asChild variant="ghost">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Keluar
              </Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!credentials) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-300" />
          <p className="mt-3 text-sm font-semibold text-slate-300">Menghubungkan ke room...</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {mediaWarning ? (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-400/30 bg-amber-400/15 px-4 py-2 text-center text-xs font-semibold text-amber-50">
          {mediaWarning} Anda tetap di dalam kelas. Aktifkan kamera/mikrofon dari kontrol video bila
          siap.
        </div>
      ) : null}
      <LiveKitRoom
        key={credentials.roomName}
        token={credentials.token}
        serverUrl={credentials.wsUrl}
        connect
        audio={enableAudio}
        video={enableVideo}
        className="h-dvh max-h-dvh overflow-hidden"
        onError={(roomError) => {
          const message = roomError.message || "Gagal menghubungkan perangkat media.";
          if (isMediaDeviceError(message)) {
            // Do not remount the room; just warn and let LiveKit controls retry.
            setMediaWarning(
              /video|camera/i.test(message)
                ? "Kamera tidak tersedia atau ditolak browser."
                : "Mikrofon/kamera gagal dimulai."
            );
            return;
          }
          ignoreDisconnectRef.current = true;
          setFatalError(message);
        }}
        onDisconnected={() => {
          if (ignoreDisconnectRef.current) {
            ignoreDisconnectRef.current = false;
            return;
          }
          setCredentials(null);
          setPhase("lobby");
          setLobbyError("Koneksi room terputus. Anda bisa masuk kembali dari lobby.");
        }}
      >
        <ConnectedRoom
          liveSessionId={liveSessionId}
          title={title}
          className={className}
          role={role}
          backHref={backHref}
          roomMode={roomMode}
          canPublishMedia={canPublishMedia}
        />
      </LiveKitRoom>
    </>
  );
}
