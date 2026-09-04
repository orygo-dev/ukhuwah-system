"use client";

import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/constants";
import type { MediaSlide } from "@/lib/app-display.shared";

export type PublicAppDisplay = {
  branding: {
    appName: string;
    logoUrl: string;
    authLogoUrl: string;
    loginTagline: string;
    loginSubtitle: string;
  };
  banners: {
    enabled: boolean;
    autoPlayMs: number;
    slides: MediaSlide[];
  };
  desktopBanners: {
    enabled: boolean;
    autoPlayMs: number;
    slides: MediaSlide[];
  };
  popup: {
    enabled: boolean;
    revision: string;
    slides: MediaSlide[];
  };
  quickMenuIcons: {
    revision: string;
    icons: Record<
      | "attendance"
      | "assignments"
      | "quiz"
      | "pjj"
      | "tka"
      | "reading"
      | "creations"
      | "board",
      string
    >;
  };
  splash: {
    enabled: boolean;
    logoUrl: string;
    backgroundUrl: string;
    durationMs: number;
  };
};

const DEFAULT: PublicAppDisplay = {
  branding: {
    appName: APP_NAME,
    logoUrl: "",
    authLogoUrl: "",
    loginTagline: "Fokus mengajar,\nbiarkan AI urus administrasi.",
    loginSubtitle: "",
  },
  banners: { enabled: false, autoPlayMs: 5000, slides: [] },
  desktopBanners: { enabled: false, autoPlayMs: 5000, slides: [] },
  popup: { enabled: false, revision: "initial", slides: [] },
  quickMenuIcons: {
    revision: "initial",
    icons: {
      attendance: "",
      assignments: "",
      quiz: "",
      pjj: "",
      tka: "",
      reading: "",
      creations: "",
      board: "",
    },
  },
  splash: { enabled: false, logoUrl: "", backgroundUrl: "", durationMs: 1000 },
};

let cache: PublicAppDisplay | null = null;
let inflight: Promise<PublicAppDisplay> | null = null;

export function invalidateAppDisplayCache() {
  cache = null;
  inflight = null;
}

export async function fetchAppDisplay(forceRefresh = false): Promise<PublicAppDisplay> {
  if (forceRefresh) {
    invalidateAppDisplayCache();
  }
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch("/api/app-display", {
    cache: "no-store",
    headers: forceRefresh ? { "x-app-display-refresh": "1" } : undefined,
  })
    .then(async (res) => {
      if (!res.ok) return DEFAULT;
      const data = await res.json();
      cache = { ...DEFAULT, ...data };
      return cache!;
    })
    .catch(() => DEFAULT)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useAppDisplay() {
  const [data, setData] = useState<PublicAppDisplay>(cache ?? DEFAULT);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let cancelled = false;
    fetchAppDisplay().then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
