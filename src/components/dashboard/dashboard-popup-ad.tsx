"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, X } from "lucide-react";
import type { MediaSlide } from "@/lib/app-display.shared";
import { toSameOriginUploadUrl } from "@/lib/upload-url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SESSION_KEY = "gs_popup_ad_campaign";

export function clearDashboardPopupSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Logout tetap dilanjutkan saat storage browser tidak tersedia.
  }
}

type DashboardPopupAdProps = {
  enabled: boolean;
  revision?: string;
  slides: MediaSlide[];
  previewMode?: boolean;
  onDismiss?: () => void;
};

function getCampaignSignature(revision: string | undefined, slides: MediaSlide[]) {
  return JSON.stringify(
    [
      revision || "legacy",
      slides.map((slide) => [
        slide.id,
        slide.type,
        slide.mediaUrl,
        slide.linkUrl || "",
        slide.title || "",
        slide.sortOrder,
      ]),
    ]
  );
}

function PopupMedia({ slide }: { slide: MediaSlide }) {
  const src = toSameOriginUploadUrl(slide.mediaUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src, slide.type]);

  if (!src) {
    return (
      <div className="flex min-h-[220px] min-w-[280px] max-w-[92vw] flex-col items-center justify-center gap-2 bg-slate-900 px-6 py-10 text-center text-white">
        <ImageOff className="h-8 w-8 text-white/70" />
        <p className="text-sm font-medium">Media popup belum tersedia</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex min-h-[220px] min-w-[280px] max-w-[92vw] flex-col items-center justify-center gap-2 bg-slate-900 px-6 py-10 text-center text-white">
        <ImageOff className="h-8 w-8 text-white/70" />
        <p className="text-sm font-medium">Media gagal dimuat</p>
        <p className="max-w-sm break-all text-xs text-white/60">{src}</p>
      </div>
    );
  }

  if (slide.type === "video") {
    return (
      <video
        src={src}
        className="block h-auto min-h-[180px] min-w-[240px] max-h-[82dvh] w-auto max-w-[92vw] bg-black object-contain"
        controls
        playsInline
        autoPlay
        muted
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={slide.title || "Promo"}
      loading="eager"
      decoding="async"
      onError={() => setFailed(true)}
      className="block h-auto min-h-[180px] min-w-[240px] max-h-[82dvh] w-auto max-w-[92vw] object-contain"
    />
  );
}

export function DashboardPopupAd({
  enabled,
  revision,
  slides,
  previewMode = false,
  onDismiss,
}: DashboardPopupAdProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const campaignSignature = getCampaignSignature(revision, slides);

  useEffect(() => {
    if (!enabled || !slides.length) {
      setOpen(false);
      return;
    }
    if (!previewMode) {
      try {
        if (sessionStorage.getItem(SESSION_KEY) === campaignSignature) return;
        sessionStorage.setItem(SESSION_KEY, campaignSignature);
      } catch {
        // Popup tetap ditampilkan bila storage browser tidak tersedia.
      }
    }
    setOpen(true);
    setIndex(0);
  }, [campaignSignature, enabled, previewMode, slides.length]);

  const dismiss = () => {
    setOpen(false);
    onDismiss?.();
  };

  if (!open || !slides.length) return null;

  const slide = slides[Math.min(index, slides.length - 1)];
  if (!slide) return null;

  const media = <PopupMedia slide={slide} />;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-popup-title"
    >
      <div className="relative flex min-w-[260px] max-w-[94vw] flex-col overflow-hidden rounded-[1.35rem] bg-slate-950 shadow-[0_28px_90px_rgba(0,0,0,0.55)] ring-1 ring-white/20">
        <h2 id="dashboard-popup-title" className="sr-only">
          Popup promosi
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tutup popup"
          className="absolute right-2.5 top-2.5 z-20 h-9 w-9 rounded-full border border-white/30 bg-black/60 text-white shadow-lg backdrop-blur-md hover:bg-black/80 hover:text-white"
          onClick={dismiss}
        >
          <X className="h-5 w-5" />
        </Button>

        {slide.linkUrl ? (
          <Link
            href={slide.linkUrl}
            target={slide.linkUrl.startsWith("http") ? "_blank" : undefined}
            rel={slide.linkUrl.startsWith("http") ? "noopener noreferrer" : undefined}
            onClick={dismiss}
            className="block bg-black"
          >
            {media}
          </Link>
        ) : (
          media
        )}

        {(slide.title || slides.length > 1) && (
          <div className="flex items-center gap-3 border-t border-white/10 bg-slate-950 px-4 py-3 text-white">
            {slide.title && (
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{slide.title}</p>
            )}
            {slides.length > 1 && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        i === index ? "w-4 bg-white" : "w-1.5 bg-white/35"
                      )}
                      aria-label={`Promo ${i + 1}`}
                    />
                  ))}
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={dismiss}>
                  Tutup
                </Button>
              </div>
            )}
            {!slide.title && slides.length === 1 && (
              <div className="ml-auto flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={dismiss}>
                  Tutup
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
