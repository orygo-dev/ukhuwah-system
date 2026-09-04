"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MediaSlide } from "@/lib/app-display.shared";
import { cn } from "@/lib/utils";

type DashboardMobileBannerCarouselProps = {
  slides: MediaSlide[];
  autoPlayMs?: number;
  className?: string;
};

const SLIDE_WIDTH = "84%";
const SLIDE_GAP = "0.75rem";
const PEEK_OFFSET = "8%";

function SlideMedia({ slide }: { slide: MediaSlide }) {
  if (slide.type === "video") {
    return (
      <video
        src={slide.mediaUrl}
        className="h-full w-full object-cover object-center"
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
      className="h-full w-full object-cover object-center"
    />
  );
}

function SlideCard({ slide }: { slide: MediaSlide }) {
  const media = (
    <div className="relative aspect-[2/1] w-full overflow-hidden bg-brand-50/50">
      <SlideMedia slide={slide} />
      {slide.title && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
          <p className="line-clamp-1 text-xs font-medium text-white">
            {slide.title}
          </p>
        </div>
      )}
    </div>
  );

  if (slide.linkUrl) {
    return (
      <Link
        href={slide.linkUrl}
        target={slide.linkUrl.startsWith("http") ? "_blank" : undefined}
        rel={slide.linkUrl.startsWith("http") ? "noopener noreferrer" : undefined}
        className="block overflow-hidden rounded-2xl border border-brand-100/80 shadow-sm"
      >
        {media}
      </Link>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100/80 shadow-sm">
      {media}
    </div>
  );
}

function loopIndexToDot(index: number, slideCount: number): number {
  if (index <= 0) return slideCount - 1;
  if (index >= slideCount + 1) return 0;
  return index - 1;
}

export function DashboardMobileBannerCarousel({
  slides,
  autoPlayMs = 5000,
  className,
}: DashboardMobileBannerCarouselProps) {
  const multi = slides.length > 1;
  const slideCount = slides.length;

  const loopSlides = useMemo(() => {
    if (!multi) return slides;
    return [slides[slideCount - 1], ...slides, slides[0]];
  }, [slides, multi, slideCount]);

  const [index, setIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const snapRef = useRef(false);

  useEffect(() => {
    setIndex(multi ? 1 : 0);
    setAnimate(true);
    snapRef.current = false;
  }, [slides, multi]);

  const next = useCallback(() => {
    if (!multi) return;
    setAnimate(true);
    setIndex((i) => i + 1);
  }, [multi]);

  useEffect(() => {
    if (!multi) return;
    const timer = setInterval(next, autoPlayMs);
    return () => clearInterval(timer);
  }, [multi, autoPlayMs, next]);

  const handleTransitionEnd = useCallback(() => {
    if (!multi || snapRef.current) return;

    if (index === loopSlides.length - 1) {
      snapRef.current = true;
      setAnimate(false);
      setIndex(1);
    }
  }, [index, loopSlides.length, multi]);

  useEffect(() => {
    if (!animate && index === 1 && snapRef.current) {
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          snapRef.current = false;
        });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [animate, index]);

  if (!slides.length) return null;

  if (!multi) {
    return (
      <div className={cn("lg:hidden", className)}>
        <SlideCard slide={slides[0]} />
      </div>
    );
  }

  const activeDot = loopIndexToDot(index, slideCount);

  return (
    <div className={cn("lg:hidden", className)}>
      <div className="overflow-hidden">
        <div
          className={cn(
            "flex gap-3",
            animate && "transition-transform duration-500 ease-out"
          )}
          style={{
            transform: `translateX(calc(${PEEK_OFFSET} - ${index} * (${SLIDE_WIDTH} + ${SLIDE_GAP})))`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {loopSlides.map((slide, i) => (
            <div
              key={`${slide.id}-${i}`}
              className="shrink-0"
              style={{ width: SLIDE_WIDTH }}
            >
              <SlideCard slide={slide} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex justify-center gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setAnimate(true);
              setIndex(i + 1);
            }}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === activeDot ? "w-5 bg-brand-600" : "w-1.5 bg-brand-200"
            )}
            aria-label={`Banner ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
