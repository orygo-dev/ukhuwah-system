"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaSlide } from "@/lib/app-display.shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type DashboardBannerCarouselProps = {
  slides: MediaSlide[];
  autoPlayMs?: number;
  className?: string;
  compact?: boolean;
  layout?: "single" | "two-up";
  fit?: "cover" | "contain";
  aspect?: "desktop" | "default";
  showCaption?: boolean;
};

function SlideMedia({
  slide,
  fit = "cover",
}: {
  slide: MediaSlide;
  fit?: "cover" | "contain";
}) {
  const mediaClass = cn(
    "h-full w-full",
    fit === "contain" ? "object-contain" : "object-cover"
  );

  if (slide.type === "video") {
    return (
      <video
        src={slide.mediaUrl}
        className={mediaClass}
        muted
        playsInline
        loop
        autoPlay
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={slide.mediaUrl}
      alt={slide.title || "Banner"}
      loading="lazy"
      decoding="async"
      className={mediaClass}
    />
  );
}

function SlideFrame({
  slide,
  compact,
  contain = false,
  aspect = "default",
  showCaption = true,
}: {
  slide: MediaSlide;
  compact: boolean;
  contain?: boolean;
  aspect?: "desktop" | "default";
  showCaption?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-white",
        aspect === "desktop"
          ? "aspect-[16/5]"
          : compact
            ? "aspect-[16/6]"
            : "aspect-[21/9] sm:aspect-[3/1]"
      )}
    >
      <SlideMedia slide={slide} fit={contain ? "contain" : "cover"} />
      {showCaption && slide.title ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-sm font-medium text-white sm:text-base">
            {slide.title}
          </p>
        </div>
      ) : null}
    </div>
  );

  return slide.linkUrl ? (
    <Link
      href={slide.linkUrl}
      target={slide.linkUrl.startsWith("http") ? "_blank" : undefined}
      rel={slide.linkUrl.startsWith("http") ? "noopener noreferrer" : undefined}
      className="block"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function DashboardBannerCarousel({
  slides,
  autoPlayMs = 5000,
  className,
  compact = false,
  layout = "single",
  fit = "cover",
  aspect = "default",
  showCaption = true,
}: DashboardBannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [withTransition, setWithTransition] = useState(true);
  const isTwoUp = layout === "two-up";
  const pageCount = isTwoUp ? Math.ceil(slides.length / 2) : slides.length;
  const trackSlides = useMemo(
    () => (!isTwoUp && slides.length > 1 ? [...slides, slides[0]] : slides),
    [isTwoUp, slides]
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      setWithTransition(true);
      setIndex((i) => {
        if (isTwoUp) return (i + dir + pageCount) % pageCount;
        if (dir > 0) return i + 1;
        return i === 0 ? pageCount - 1 : i - 1;
      });
    },
    [isTwoUp, pageCount]
  );

  useEffect(() => {
    if (pageCount <= 1) return;
    const timer = setInterval(() => go(1), autoPlayMs);
    return () => clearInterval(timer);
  }, [pageCount, autoPlayMs, go]);

  if (!slides.length) return null;

  const normalizedIndex = pageCount ? index % pageCount : 0;
  const slide = slides[normalizedIndex];
  const visibleSlides = isTwoUp
    ? slides.slice(index * 2, index * 2 + 2)
    : [slide];

  const inner = isTwoUp ? (
    <div className="grid gap-3 bg-white p-2 sm:grid-cols-2">
      {visibleSlides.map((item) => (
        <div
          key={item.id}
          className="overflow-hidden rounded-xl border border-emerald-100 bg-white"
        >
          <SlideFrame
            slide={item}
            compact={compact}
            contain
            aspect={aspect}
            showCaption={showCaption}
          />
        </div>
      ))}
    </div>
  ) : (
    <div className="overflow-hidden">
      <div
        className={cn(
          "flex",
          withTransition && "transition-transform duration-700 ease-out"
        )}
        style={{ transform: `translateX(-${index * 100}%)` }}
        onTransitionEnd={() => {
          if (index === pageCount) {
            setWithTransition(false);
            setIndex(0);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setWithTransition(true));
            });
          }
        }}
      >
        {trackSlides.map((item, itemIndex) => (
          <div key={`${item.id}-${itemIndex}`} className="w-full shrink-0">
            <SlideFrame
              slide={item}
              compact={compact}
              contain={fit === "contain"}
              aspect={aspect}
              showCaption={showCaption}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border", className)}>
      {inner}

      {pageCount > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
            onClick={() => go(-1)}
            aria-label="Slide sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
            onClick={() => go(1)}
            aria-label="Slide berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {Array.from({ length: pageCount }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setWithTransition(true);
                  setIndex(i);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === normalizedIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"
                )}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
