"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  acquirePreviewMedia,
  previewDeviceStatusLabel,
  type PjjPreviewDeviceStatus,
} from "@/lib/pjj-media-preview";

export type JoinPreferences = {
  audio: boolean;
  video: boolean;
};

export function LiveJoinLobby({
  title,
  className,
  role,
  backHref,
  joining,
  error,
  onJoin,
}: {
  title: string;
  className: string;
  role: string;
  backHref: string;
  joining?: boolean;
  error?: string | null;
  onJoin: (prefs: JoinPreferences) => void | Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [wantAudio, setWantAudio] = useState(true);
  const [wantVideo, setWantVideo] = useState(true);
  const [audioStatus, setAudioStatus] = useState<PjjPreviewDeviceStatus>("requesting");
  const [videoStatus, setVideoStatus] = useState<PjjPreviewDeviceStatus>("requesting");

  useEffect(() => {
    let cancelled = false;

    async function startPreview() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setAudioStatus(wantAudio ? "requesting" : "off");
      setVideoStatus(wantVideo ? "requesting" : "off");
      if (joining || (!wantAudio && !wantVideo)) {
        return;
      }
      const result = await acquirePreviewMedia({
        audio: wantAudio,
        video: wantVideo,
        getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      });
      if (cancelled) {
        result.tracks.forEach((track) => track.stop());
        return;
      }
      setAudioStatus(result.audio);
      setVideoStatus(result.video);
      const stream = new MediaStream(result.tracks as MediaStreamTrack[]);
      streamRef.current = stream;
      if (videoRef.current && result.video === "ready") {
        videoRef.current.srcObject = stream;
        void videoRef.current.play().catch(() => undefined);
      }
    }

    void startPreview();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [joining, wantAudio, wantVideo]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-slate-900/80 p-5 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Lobby kelas</Badge>
            <h1 className="mt-3 text-2xl font-black">{title}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {className} · {role === "STUDENT" ? "Siswa" : "Moderator"}
            </p>
          </div>
          <Button asChild variant="ghost" className="text-slate-300 hover:text-white">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black">
          <div className="relative aspect-video">
            {wantVideo ? (
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-400">
                Kamera dimatikan
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold">
                {previewDeviceStatusLabel("audio", audioStatus)}
              </span>
              <span className="rounded-full bg-black/60 px-3 py-1 text-xs font-semibold">
                {previewDeviceStatusLabel("video", videoStatus)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={wantAudio ? "secondary" : "outline"}
            onClick={() => setWantAudio((current) => !current)}
          >
            {wantAudio ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            {wantAudio ? "Mikrofon nyala" : "Mikrofon mati"}
          </Button>
          <Button
            type="button"
            variant={wantVideo ? "secondary" : "outline"}
            onClick={() => setWantVideo((current) => !current)}
          >
            {wantVideo ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            {wantVideo ? "Kamera nyala" : "Kamera mati"}
          </Button>
        </div>

        {audioStatus !== "ready" || videoStatus !== "ready" ? (
          <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
            {previewDeviceStatusLabel("audio", audioStatus)}. {previewDeviceStatusLabel("video", videoStatus)}.
            Perangkat yang tersedia tetap dapat digunakan secara independen.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-400">
            Periksa gambar dan suara Anda sebelum masuk. Pengaturan ini dipakai saat bergabung ke room.
          </p>
        )}

        {error ? (
          <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={joining}
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
              }
              void onJoin({ audio: wantAudio, video: wantVideo });
            }}
          >
            {joining ? "Menghubungkan..." : "Masuk kelas"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={joining}
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
              }
              void onJoin({ audio: true, video: false });
            }}
          >
            Masuk dengan audio saja
          </Button>
        </div>
      </div>
    </main>
  );
}
