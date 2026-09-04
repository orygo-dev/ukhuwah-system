"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatSpotlightTime,
  initials,
  type SpotlightPostDto,
} from "@/lib/spotlight";
import {
  buildSpotlightFeedWithAds,
  normalizeReelsAdsConfig,
  type GoogleAdsenseConfig,
  type ReelsAd,
  type ReelsAdsConfig,
} from "@/lib/reels-ads.shared";
import { toSameOriginUploadUrl } from "@/lib/upload-url";
import { cn } from "@/lib/utils";

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
};

function ReelComments({
  postId,
  open,
  onClose,
  onCommentAdded,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCommentAdded: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const { data: session } = useSession();

  useEffect(() => {
    if (!open) return;
    setError("");
    setLoading(true);
    fetch(`/api/spotlight/posts/${postId}/comments`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gagal memuat komentar");
        setComments(d.comments || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat"))
      .finally(() => setLoading(false));
  }, [open, postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !session) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/spotlight/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim");
      setComments((c) => [...c, data.comment]);
      setText("");
      onCommentAdded(data.commentCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengirim komentar");
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Tutup komentar"
      />
      <div className="relative z-10 flex max-h-[75%] flex-col rounded-t-2xl bg-background shadow-xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">Komentar</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Tutup
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada komentar. Jadilah yang pertama!
            </p>
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(c.user.name)}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="font-semibold">{c.user.name}</span>{" "}
                      <span className="text-muted-foreground">
                        {formatSpotlightTime(c.createdAt)}
                      </span>
                    </p>
                    <p className="text-sm">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error && (
          <p className="px-4 pb-2 text-sm text-destructive">{error}</p>
        )}
        {session ? (
          <form onSubmit={submit} className="flex gap-2 border-t p-3">
            <Input
              placeholder="Tulis komentar..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="flex-1"
              maxLength={1000}
            />
            <Button type="submit" size="sm" disabled={sending || !text.trim()}>
              Kirim
            </Button>
          </form>
        ) : (
          <p className="border-t p-3 text-center text-sm text-muted-foreground">
            <Link href="/login?callbackUrl=/dashboard/spotlight" className="text-primary hover:underline">
              Masuk
            </Link>{" "}
            untuk berkomentar
          </p>
        )}
      </div>
    </div>
  );
}

function ReelSlide({
  post,
  active,
  shouldLoad,
  onLike,
  onCommentCount,
  onDelete,
  onView,
}: {
  post: SpotlightPostDto;
  active: boolean;
  shouldLoad: boolean;
  onLike: (id: string, liked: boolean, count: number) => void;
  onCommentCount: (id: string, count: number) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [viewCount, setViewCount] = useState(post.viewCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [liking, setLiking] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [toast, setToast] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const { data: session } = useSession();

  const isAuthor = session?.user?.id === post.author.id;

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikeCount(post.likeCount);
    setCommentCount(post.commentCount);
    setViewCount(post.viewCount);
  }, [post]);

  useEffect(() => {
    if (active) onView(post.id);
  }, [active, post.id, onView]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    if (active && !commentsOpen && !videoError) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [active, commentsOpen, shouldLoad, videoError]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!shareMsg) return;
    const t = setTimeout(() => setShareMsg(""), 2000);
    return () => clearTimeout(t);
  }, [shareMsg]);

  const toggleLike = async () => {
    if (!session) {
      setToast("Masuk dulu untuk menyukai");
      return;
    }
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    try {
      const res = await fetch(`/api/spotlight/posts/${post.id}/like`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLiked(data.liked);
      setLikeCount(data.likeCount);
      onLike(post.id, data.liked, data.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      setToast("Gagal memperbarui suka");
    } finally {
      setLiking(false);
    }
  };

  const handleDoubleTap = () => {
    if (!liked) {
      toggleLike();
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 800);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/spotlight/teacher/${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Zona Kreasi Navalogi",
          text: post.caption,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link disalin!");
      }
    } catch {
      /* user cancelled share */
    }
  };

  const handleDelete = async () => {
    if (!confirm("Hapus Zona Kreasi ini?")) return;
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/spotlight/posts/${post.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      onDelete(post.id);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  return (
    <section className="relative h-full w-full snap-start snap-always bg-black">
      {shouldLoad && !videoError ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          poster={post.thumbnailUrl || undefined}
          loop
          muted={muted}
          playsInline
          preload={active ? "auto" : "metadata"}
          className="h-full w-full object-cover"
          onDoubleClick={handleDoubleTap}
          onError={() => setVideoError(true)}
        />
      ) : videoError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="font-medium">Video tidak dapat diputar</p>
          <p className="text-sm text-white/70">
            Pastikan URL video valid (MP4/WebM langsung).
          </p>
        </div>
      ) : (
        <div className="h-full w-full bg-zinc-900" />
      )}

      {heartBurst && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 animate-ping fill-red-500 text-red-500 opacity-90" />
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

      {(toast || shareMsg) && (
        <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm text-white backdrop-blur-sm">
          {toast || shareMsg}
        </div>
      )}

      <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={toggleLike}
          disabled={liking}
          className="pointer-events-auto flex flex-col items-center gap-1 text-white"
          aria-label="Suka"
        >
          <span
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-transform active:scale-95",
              liked ? "bg-red-500/90" : "bg-black/40"
            )}
          >
            <Heart className={cn("h-6 w-6", liked && "fill-white")} />
          </span>
          <span className="text-xs font-medium drop-shadow">{likeCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="pointer-events-auto flex flex-col items-center gap-1 text-white"
          aria-label="Komentar"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span className="text-xs font-medium drop-shadow">{commentCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label={muted ? "Nyalakan suara" : "Matikan suara"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="Bagikan"
        >
          <Share2 className="h-5 w-5" />
        </button>

        {isAuthor && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
              aria-label="Opsi"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="pointer-events-auto absolute bottom-full right-0 mb-2 min-w-[140px] rounded-lg border bg-background py-1 text-foreground shadow-lg">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-0 right-14 z-20 px-4 text-white">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/80 text-xs font-bold">
            {initials(post.author.name)}
          </div>
          <span className="font-semibold drop-shadow">{post.author.name}</span>
          <span className="text-xs text-white/70">
            · {formatSpotlightTime(post.createdAt)}
          </span>
        </div>
        <p
          className={cn(
            "text-sm leading-relaxed drop-shadow",
            !captionExpanded && "line-clamp-2"
          )}
        >
          {post.caption}
        </p>
        {post.caption.length > 80 && (
          <button
            type="button"
            onClick={() => setCaptionExpanded((e) => !e)}
            className="mt-1 flex items-center gap-0.5 text-xs font-medium text-white/80"
          >
            {captionExpanded ? (
              <>
                Sembunyikan <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Selengkapnya <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
        <p className="mt-2 flex items-center gap-1 text-xs text-white/60">
          <Eye className="h-3 w-3" />
          {viewCount.toLocaleString("id-ID")} tayangan
        </p>
      </div>

      <ReelComments
        postId={post.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={(count) => {
          setCommentCount(count);
          onCommentCount(post.id, count);
        }}
      />
    </section>
  );
}

function ReelsAdSlide({
  ad,
  active,
  shouldLoad,
  onImpression,
  onClick,
}: {
  ad: ReelsAd;
  active: boolean;
  shouldLoad: boolean;
  onImpression: (id: string) => void;
  onClick: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const src = toSameOriginUploadUrl(ad.mediaUrl);

  useEffect(() => {
    setMediaError(false);
  }, [src, ad.type]);

  useEffect(() => {
    if (!active) return;
    onImpression(ad.id);
  }, [active, ad.id, onImpression]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || ad.type !== "video") return;
    if (active && shouldLoad) {
      video.muted = muted;
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active, shouldLoad, muted, ad.type, src]);

  const openLink = () => {
    if (!ad.linkUrl) return;
    onClick(ad.id);
    if (ad.linkUrl.startsWith("http")) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(ad.linkUrl);
    }
  };

  return (
    <section className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {mediaError || !src ? (
        <div className="px-6 text-center text-white">
          <p className="text-sm font-medium">Media iklan tidak tersedia</p>
        </div>
      ) : ad.type === "video" ? (
        shouldLoad ? (
          <video
            ref={videoRef}
            src={src}
            className="h-full w-full object-contain"
            playsInline
            loop
            muted={muted}
            onError={() => setMediaError(true)}
          />
        ) : (
          <div className="h-full w-full bg-black" />
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={ad.title || "Promo"}
          className="h-full w-full object-contain"
          onError={() => setMediaError(true)}
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

      <div className="absolute left-4 top-20 z-10">
        <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
          Promo
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 space-y-3 p-4 pb-10 text-white">
        <div>
          <p className="text-sm font-semibold text-white/80">Navalogi</p>
          {ad.title ? <p className="mt-1 text-lg font-bold">{ad.title}</p> : null}
          {ad.caption ? (
            <p className="mt-1 text-sm leading-5 text-white/85">{ad.caption}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {ad.linkUrl ? (
            <Button
              type="button"
              size="sm"
              className="pointer-events-auto rounded-full bg-white text-slate-900 hover:bg-white/90"
              onClick={openLink}
            >
              {ad.ctaLabel || "Pelajari"}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          ) : null}
          {ad.type === "video" ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="pointer-events-auto h-9 w-9 rounded-full bg-black/40 text-white hover:bg-black/60 hover:text-white"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type AdsByGoogleWindow = Window & {
  adsbygoogle?: Array<Record<string, unknown>>;
};

function GoogleAdsenseSlide({
  config,
  active,
  shouldLoad,
  scriptFailed,
}: {
  config: GoogleAdsenseConfig;
  active: boolean;
  shouldLoad: boolean;
  scriptFailed: boolean;
}) {
  const adRef = useRef<HTMLModElement>(null);
  const requestedRef = useRef(false);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    if (!active || !shouldLoad || !adRef.current || requestedRef.current) return;
    let errorTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const adsWindow = window as AdsByGoogleWindow;
      adsWindow.adsbygoogle = adsWindow.adsbygoogle || [];
      adsWindow.adsbygoogle.push({});
      requestedRef.current = true;
    } catch {
      errorTimer = setTimeout(() => setRequestError(true), 0);
    }
    return () => {
      if (errorTimer) clearTimeout(errorTimer);
    };
  }, [active, shouldLoad]);

  return (
    <section className="flex h-full w-full items-center justify-center bg-slate-950 px-4 py-24">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-4 shadow-2xl">
        <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Iklan oleh Google
        </p>
        {shouldLoad && !requestError && !scriptFailed ? (
          <ins
            ref={adRef}
            className="adsbygoogle min-h-[280px] w-full"
            style={{ display: "block" }}
            data-ad-client={config.publisherId}
            data-ad-slot={config.slotId}
            data-ad-format="rectangle"
            data-full-width-responsive="true"
            data-tag-for-age-treatment={2}
          />
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-slate-50 px-6 text-center text-sm text-slate-500">
            {requestError || scriptFailed
              ? "Iklan tidak dapat dimuat. Konten Zona Kreasi tetap dapat digunakan."
              : "Iklan akan dimuat saat slide aktif."}
          </div>
        )}
        <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
          Personalisasi dan remarketing dinonaktifkan untuk perlindungan pengguna remaja.
        </p>
      </div>
    </section>
  );
}

export function SpotlightFeed({ initialPostId }: { initialPostId?: string }) {
  const [posts, setPosts] = useState<SpotlightPostDto[]>([]);
  const [adsConfig, setAdsConfig] = useState<ReelsAdsConfig>(() =>
    normalizeReelsAdsConfig(null)
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [adsScriptFailed, setAdsScriptFailed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const impressedAdsRef = useRef<Set<string>>(new Set());
  const initialScrollIndexRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const loadMoreAbortRef = useRef<AbortController | null>(null);
  const retryAbortRef = useRef<AbortController | null>(null);

  const feedItems = useMemo(
    () => buildSpotlightFeedWithAds(posts, adsConfig),
    [posts, adsConfig]
  );

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const loadFeed = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    const url = cursor
      ? `/api/spotlight/posts?cursor=${cursor}&limit=8`
      : "/api/spotlight/posts?limit=8";
    const res = await fetch(url, { signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gagal memuat Zona Kreasi");
    return data as { posts: SpotlightPostDto[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadFeed(undefined, controller.signal)
      .then((data) => {
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
        if (initialPostId) {
          const idx = data.posts.findIndex((post) => post.id === initialPostId);
          if (idx >= 0) setActiveIndex(idx);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setLoadError(cause instanceof Error ? cause.message : "Gagal memuat");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    void fetch("/api/spotlight/reels-ads", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((ads) => {
        if (!controller.signal.aborted) setAdsConfig(normalizeReelsAdsConfig(ads));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [loadFeed, initialPostId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || feedItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute("data-index"));
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.55 }
    );

    const slides = container.querySelectorAll("[data-reel-index]");
    slides.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [feedItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !initialPostId || feedItems.length === 0) return;
    const idx = feedItems.findIndex(
      (item) => item.kind === "post" && item.post.id === initialPostId
    );
    if (idx < 0) return;
    if (initialScrollIndexRef.current === idx) return;
    const el = container.querySelector(`[data-reel-index="${idx}"]`);
    el?.scrollIntoView({ behavior: "auto" });
    setActiveIndex(idx);
    initialScrollIndexRef.current = idx;
  }, [feedItems, initialPostId]);

  useEffect(
    () => () => {
      const controller = loadMoreAbortRef.current;
      loadMoreAbortRef.current = null;
      loadingMoreRef.current = false;
      controller?.abort();
      const retryController = retryAbortRef.current;
      retryAbortRef.current = null;
      retryController?.abort();
    },
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, feedItems.length - 1);
        container.querySelector(`[data-reel-index="${next}"]`)?.scrollIntoView({
          behavior: "smooth",
        });
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        container.querySelector(`[data-reel-index="${prev}"]`)?.scrollIntoView({
          behavior: "smooth",
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, feedItems.length]);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container || !nextCursor || loadingMoreRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
      setLoadMoreError("");
      const controller = new AbortController();
      loadMoreAbortRef.current = controller;
      loadFeed(nextCursor, controller.signal)
        .then((data) => {
          setPosts((p) => [...p, ...data.posts]);
          setNextCursor(data.nextCursor);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoadMoreError("Gagal memuat Zona Kreasi lainnya.");
        })
        .finally(() => {
          if (loadMoreAbortRef.current === controller) {
            loadMoreAbortRef.current = null;
            loadingMoreRef.current = false;
            setLoadingMore(false);
          }
        });
    }
  };

  const trackView = useCallback((postId: string) => {
    if (viewedRef.current.has(postId)) return;
    viewedRef.current.add(postId);
    fetch(`/api/spotlight/posts/${postId}/view`, { method: "POST" }).then(
      async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, viewCount: data.viewCount } : p
          )
        );
      }
    );
  }, []);

  const trackAdImpression = useCallback((adId: string) => {
    if (impressedAdsRef.current.has(adId)) return;
    impressedAdsRef.current.add(adId);
    void fetch("/api/spotlight/reels-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, event: "impression" }),
    });
  }, []);

  const trackAdClick = useCallback((adId: string) => {
    void fetch("/api/spotlight/reels-ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adId, event: "click" }),
    });
  }, []);

  const updateLike = (id: string, liked: boolean, count: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, likedByMe: liked, likeCount: count } : p
      )
    );
  };

  const updateCommentCount = (id: string, count: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, commentCount: count } : p))
    );
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setActiveIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black lg:left-64">
      {adsConfig.enabled &&
      adsConfig.provider === "google-adsense" ? (
        <Script
          id={`genpro-adsense-${adsConfig.googleAdsense.publisherId}`}
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.googleAdsense.publisherId)}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
          onError={() => setAdsScriptFailed(true)}
        />
      ) : null}
      <header className="absolute left-0 right-0 top-0 z-40 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-3 safe-area-inset-top">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/10"
          asChild
        >
          <Link href="/dashboard">
            <ArrowLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Beranda</span>
          </Link>
        </Button>
        <h1 className="text-lg font-bold text-white drop-shadow">Zona Kreasi</h1>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          asChild
        >
          <Link href="/dashboard/spotlight/buat" aria-label="Buat Zona Kreasi">
            <Plus className="h-5 w-5" />
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      ) : loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <p>{loadError}</p>
          <Button
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
            onClick={() => {
              retryAbortRef.current?.abort();
              const controller = new AbortController();
              retryAbortRef.current = controller;
              setLoading(true);
              setLoadError("");
              loadFeed(undefined, controller.signal)
                .then((data) => {
                  if (retryAbortRef.current === controller) {
                    setPosts(data.posts);
                    setNextCursor(data.nextCursor);
                  }
                })
                .catch((cause) => {
                  if (!controller.signal.aborted) {
                    setLoadError(cause instanceof Error ? cause.message : "Gagal memuat");
                  }
                })
                .finally(() => {
                  if (retryAbortRef.current === controller) {
                    retryAbortRef.current = null;
                    setLoading(false);
                  }
                });
            }}
          >
            Coba lagi
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
          <p className="text-lg font-medium">Belum ada Zona Kreasi</p>
          <p className="text-sm text-white/70">
            Bagikan video pendek tips mengajar untuk inspirasi guru lainnya.
          </p>
          <Button variant="brand" asChild>
            <Link href="/dashboard/spotlight/buat">Buat Zona Kreasi Pertama</Link>
          </Button>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="mx-auto h-full w-full max-w-lg snap-y snap-mandatory overflow-y-scroll overscroll-y-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {feedItems.map((item, index) => (
            <div
              key={item.id}
              data-reel-index={index}
              data-index={index}
              className="h-[100dvh] w-full shrink-0 snap-start"
            >
              {item.kind === "post" ? (
                <ReelSlide
                  post={item.post}
                  active={index === activeIndex}
                  shouldLoad={Math.abs(index - activeIndex) <= 1}
                  onLike={updateLike}
                  onCommentCount={updateCommentCount}
                  onDelete={handleDelete}
                  onView={trackView}
                />
              ) : item.kind === "ad" ? (
                <ReelsAdSlide
                  ad={item.ad}
                  active={index === activeIndex}
                  shouldLoad={Math.abs(index - activeIndex) <= 1}
                  onImpression={trackAdImpression}
                  onClick={trackAdClick}
                />
              ) : item.kind === "google-ad" ? (
                <GoogleAdsenseSlide
                  config={item.config}
                  active={index === activeIndex}
                  shouldLoad={Math.abs(index - activeIndex) <= 1}
                  scriptFailed={adsScriptFailed}
                />
              ) : null}
            </div>
          ))}
          {loadingMore && (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {!loading && posts.length > 0 && (
        <p className="pointer-events-none absolute bottom-2 left-0 right-0 z-30 text-center text-[10px] text-white/40">
          Geser ↑↓ · Tombol panah keyboard
        </p>
      )}
      {loadMoreError ? (
        <p className="pointer-events-none absolute bottom-7 left-1/2 z-30 -translate-x-1/2 rounded-full bg-red-950/90 px-3 py-1 text-center text-[11px] text-white">
          {loadMoreError} Geser lagi untuk mencoba ulang.
        </p>
      ) : null}
    </div>
  );
}
