"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Film, Loader2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  canExportTrimmedClip,
  captureVideoThumbnail,
  exportTrimmedClip,
  formatTrimClock,
} from "@/lib/spotlight-trim";
import { STUDENT_SPOTLIGHT_MAX_SECONDS } from "@/lib/spotlight-video";

export type SpotlightTrimResult = {
  file: File;
  thumbnail: File | null;
  duration: number;
  objectUrl: string;
  posterUrl: string | null;
};

type SpotlightVideoTrimmerProps = {
  disabled?: boolean;
  onReady: (result: SpotlightTrimResult | null) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function SpotlightVideoTrimmer({ disabled, onReady }: SpotlightVideoTrimmerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(STUDENT_SPOTLIGHT_MAX_SECONDS);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [readyLabel, setReadyLabel] = useState("");

  const maxWindow = STUDENT_SPOTLIGHT_MAX_SECONDS;
  const selectionLength = Math.max(0, end - start);
  const needsTrim = duration > maxWindow + 0.05;
  const isFullShortClip =
    duration > 0 && duration <= maxWindow + 0.05 && start <= 0.05 && end >= duration - 0.05;

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceUrl) return;

    const onTimeUpdate = () => {
      if (video.currentTime < start) {
        video.currentTime = start;
      }
      if (video.currentTime >= end) {
        video.currentTime = start;
        void video.play().catch(() => undefined);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [sourceUrl, start, end]);

  const timelineStyle = useMemo(() => {
    if (!duration) return { left: "0%", width: "100%" };
    return {
      left: `${(start / duration) * 100}%`,
      width: `${((end - start) / duration) * 100}%`,
    };
  }, [duration, start, end]);

  const resetReady = () => {
    setReadyLabel("");
    onReady(null);
  };

  const clearSource = () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceFile(null);
    setSourceUrl("");
    setDuration(0);
    setStart(0);
    setEnd(maxWindow);
    setError("");
    resetReady();
    if (inputRef.current) inputRef.current.value = "";
  };

  const onPickFile = (file: File | null) => {
    resetReady();
    setError("");
    if (!file) {
      clearSource();
      return;
    }
    if (!file.type.startsWith("video/")) {
      setError("Pilih file video (MP4, MOV, atau WebM).");
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    const nextUrl = URL.createObjectURL(file);
    setSourceFile(file);
    setSourceUrl(nextUrl);
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!nextDuration || nextDuration < 0.5) {
      setError("Video terlalu pendek atau tidak dapat dibaca.");
      return;
    }
    setDuration(nextDuration);
    setStart(0);
    setEnd(Math.min(nextDuration, maxWindow));
    video.currentTime = 0;
  };

  const moveWindow = (nextStart: number) => {
    if (!duration) return;
    const length = clamp(end - start, 0.5, Math.min(maxWindow, duration));
    const maxStart = Math.max(0, duration - length);
    const s = clamp(nextStart, 0, maxStart);
    setStart(s);
    setEnd(s + length);
    resetReady();
    if (videoRef.current) videoRef.current.currentTime = s;
  };

  const resizeFromStart = (nextStart: number) => {
    if (!duration) return;
    const minStart = Math.max(0, end - maxWindow);
    const maxStart = Math.max(0, end - 0.5);
    const s = clamp(nextStart, minStart, maxStart);
    setStart(s);
    resetReady();
    if (videoRef.current) videoRef.current.currentTime = s;
  };

  const resizeFromEnd = (nextEnd: number) => {
    if (!duration) return;
    const minEnd = Math.min(duration, start + 0.5);
    const maxEnd = Math.min(duration, start + maxWindow);
    const e = clamp(nextEnd, minEnd, maxEnd);
    setEnd(e);
    resetReady();
  };

  const applyClip = async () => {
    const video = videoRef.current;
    if (!video || !sourceFile || !duration) return;
    setExporting(true);
    setError("");
    resetReady();
    try {
      let outputFile: File;
      let previewUrl = "";

      if (isFullShortClip) {
        outputFile = sourceFile;
        previewUrl = sourceUrl;
      } else {
        if (!canExportTrimmedClip(video)) {
          throw new Error(
            "Browser ini belum mendukung pemotongan video. Gunakan Chrome/Firefox di Android, atau potong dulu di galeri hingga maksimal 30 detik."
          );
        }
        const { blob, extension } = await exportTrimmedClip(video, { start, end });
        outputFile = new File([blob], `spotlight-clip.${extension}`, {
          type: blob.type || (extension === "mp4" ? "video/mp4" : "video/webm"),
        });
        previewUrl = URL.createObjectURL(blob);
      }

      const thumbBlob = await captureVideoThumbnail(video, start);
      const thumbnail = thumbBlob
        ? new File([thumbBlob], "spotlight-thumb.jpg", { type: "image/jpeg" })
        : null;
      const posterUrl = thumbBlob ? URL.createObjectURL(thumbBlob) : null;

      onReady({
        file: outputFile,
        thumbnail,
        duration: selectionLength,
        objectUrl: previewUrl,
        posterUrl,
      });
      setReadyLabel(
        isFullShortClip
          ? "Video siap dikirim."
          : `Potongan ${formatTrimClock(selectionLength)} siap dikirim.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memotong video.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Video Zona Kreasi</Label>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/*"
          disabled={disabled || exporting}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
          onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-slate-500">
          Maksimal {maxWindow} detik setelah dipotong. Format: MP4, MOV, atau WebM.
        </p>
      </div>

      {sourceUrl ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="overflow-hidden rounded-xl bg-slate-950">
            <video
              ref={videoRef}
              src={sourceUrl}
              playsInline
              controls
              className="mx-auto max-h-72 w-full object-contain"
              onLoadedMetadata={onLoadedMetadata}
            />
          </div>

          {duration > 0 ? (
            <>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <Film className="h-3.5 w-3.5" />
                  Total {formatTrimClock(duration)}
                </span>
                <span>
                  Dipilih {formatTrimClock(start)} – {formatTrimClock(end)} (
                  {formatTrimClock(selectionLength)})
                </span>
              </div>

              {needsTrim ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                  Video lebih panjang dari {maxWindow} detik. Geser batas untuk memilih bagian yang
                  akan dikirim.
                </p>
              ) : (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  Video sudah di bawah {maxWindow} detik. Anda bisa langsung memakai seluruh klip
                  atau memotong sebagian.
                </p>
              )}

              <div className="space-y-2">
                <div className="relative h-10 rounded-full bg-slate-200">
                  <div
                    className="absolute top-0 h-full rounded-full bg-emerald-500/35"
                    style={timelineStyle}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.05}
                    value={start}
                    disabled={disabled || exporting}
                    onChange={(event) => resizeFromStart(Number(event.target.value))}
                    className="absolute inset-0 z-10 w-full appearance-none bg-transparent accent-blue-600"
                    aria-label="Awal potongan"
                  />
                </div>
                <div className="relative h-10 rounded-full bg-slate-200">
                  <div
                    className="absolute top-0 h-full rounded-full bg-emerald-500/35"
                    style={timelineStyle}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    step={0.05}
                    value={end}
                    disabled={disabled || exporting}
                    onChange={(event) => resizeFromEnd(Number(event.target.value))}
                    className="absolute inset-0 z-10 w-full appearance-none bg-transparent accent-blue-600"
                    aria-label="Akhir potongan"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Geser jendela potongan</Label>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, duration - selectionLength)}
                    step={0.05}
                    value={start}
                    disabled={disabled || exporting || duration <= selectionLength}
                    onChange={(event) => moveWindow(Number(event.target.value))}
                    className="w-full accent-blue-600"
                    aria-label="Geser jendela potongan"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => void applyClip()}
                  disabled={disabled || exporting || selectionLength < 0.5}
                  className="rounded-xl"
                >
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Scissors className="mr-2 h-4 w-4" />
                  )}
                  {isFullShortClip ? "Gunakan video ini" : "Gunakan potongan ini"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={disabled || exporting}
                  onClick={clearSource}
                >
                  Ganti video
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {readyLabel ? (
        <p className="text-xs font-semibold text-emerald-700">{readyLabel}</p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
