import { STUDENT_SPOTLIGHT_MAX_SECONDS } from "@/lib/spotlight-video";

export type TrimRange = {
  start: number;
  end: number;
};

type CapturableVideo = HTMLVideoElement & {
  captureStream?: (frameRate?: number) => MediaStream;
  mozCaptureStream?: (frameRate?: number) => MediaStream;
};

function asCapturableVideo(video: HTMLVideoElement): CapturableVideo {
  return video as CapturableVideo;
}

function pickRecorderMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "";
}

function waitForSeeked(video: HTMLVideoElement) {
  return new Promise<void>((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Gagal mencari posisi video."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

export function canExportTrimmedClip(video: HTMLVideoElement) {
  const capturable = asCapturableVideo(video);
  const capture =
    typeof capturable.captureStream === "function" ||
    typeof capturable.mozCaptureStream === "function";
  return Boolean(capture && typeof MediaRecorder !== "undefined" && pickRecorderMimeType());
}

export async function captureVideoThumbnail(
  video: HTMLVideoElement,
  atSeconds: number
): Promise<Blob | null> {
  try {
    const previous = video.currentTime;
    video.pause();
    video.currentTime = Math.max(0, Math.min(atSeconds, video.duration || atSeconds));
    await waitForSeeked(video);

    const width = video.videoWidth || 720;
    const height = video.videoHeight || 1280;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82);
    });

    video.currentTime = previous;
    return blob;
  } catch {
    return null;
  }
}

/**
 * Records the selected range from an HTML video element via MediaRecorder.
 * Re-encodes in the browser (WhatsApp-style short clip export).
 */
export async function exportTrimmedClip(
  video: HTMLVideoElement,
  range: TrimRange
): Promise<{ blob: Blob; extension: "webm" | "mp4" }> {
  const start = Math.max(0, range.start);
  const end = Math.min(video.duration || range.end, range.end);
  if (end - start < 0.4) {
    throw new Error("Potongan terlalu pendek. Pilih minimal sekitar 1 detik.");
  }
  if (end - start > STUDENT_SPOTLIGHT_MAX_SECONDS + 0.25) {
    throw new Error(`Potongan maksimal ${STUDENT_SPOTLIGHT_MAX_SECONDS} detik.`);
  }
  if (!canExportTrimmedClip(video)) {
    throw new Error(
      "Browser ini belum mendukung pemotongan video. Gunakan Chrome/Firefox di Android, atau potong dulu di galeri HP."
    );
  }

  const mimeType = pickRecorderMimeType();
  const capturable = asCapturableVideo(video);
  const captureStream =
    typeof capturable.captureStream === "function"
      ? capturable.captureStream.bind(capturable)
      : capturable.mozCaptureStream?.bind(capturable);
  if (!captureStream) {
    throw new Error(
      "Browser ini belum mendukung pemotongan video. Gunakan Chrome/Firefox di Android, atau potong dulu di galeri HP."
    );
  }

  video.pause();
  video.currentTime = start;
  await waitForSeeked(video);

  const stream = captureStream();
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: 2_500_000,
  });

  const recorded = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Gagal merekam potongan video."));
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
    };
  });

  const stopAt = () => {
    if (recorder.state !== "inactive") recorder.stop();
    video.pause();
    video.removeEventListener("timeupdate", onTimeUpdate);
    video.removeEventListener("ended", onEnded);
  };

  const onTimeUpdate = () => {
    if (video.currentTime >= end - 0.04) stopAt();
  };
  const onEnded = () => stopAt();

  video.addEventListener("timeupdate", onTimeUpdate);
  video.addEventListener("ended", onEnded);

  recorder.start(200);
  await video.play();

  const safetyMs = Math.ceil((end - start + 1.5) * 1000);
  const timeout = window.setTimeout(() => stopAt(), safetyMs);

  try {
    const blob = await recorded;
    window.clearTimeout(timeout);
    if (blob.size < 1024) {
      throw new Error("Hasil potongan kosong. Coba ulang atau gunakan video lain.");
    }
    const extension = (mimeType.includes("mp4") ? "mp4" : "webm") as "webm" | "mp4";
    return { blob, extension };
  } catch (error) {
    window.clearTimeout(timeout);
    stopAt();
    throw error;
  }
}

export function formatTrimClock(seconds: number) {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
