"use client";

import { useEffect, useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdSession = {
  sessionId: string;
  provider: string;
  minWatchSeconds: number;
  creditsPerAd: number;
};

type AdWatchModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

async function readJsonResponse(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || "Terjadi kesalahan. Silakan coba lagi.");
  }
  return data;
}

export function AdWatchModal({
  open,
  onClose,
  onSuccess,
  onError,
}: AdWatchModalProps) {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AdSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [watching, setWatching] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSession(null);
      setWatching(false);
      setRemaining(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch("/api/reward/ad/session", { method: "POST" })
      .then(async (res) => {
        const json = await readJsonResponse(res);
        if (!cancelled) {
          setSession(json);
          setRemaining(json.minWatchSeconds);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          onError(e instanceof Error ? e.message : "Gagal memulai iklan");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, onClose, onError]);

  useEffect(() => {
    if (!watching || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [watching, remaining]);

  const startWatch = () => {
    if (!session) return;
    setWatching(true);
    setRemaining(session.minWatchSeconds);
  };

  const completeWatch = async () => {
    if (!session || remaining > 0 || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/reward/ad/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const json = await readJsonResponse(res);
      onSuccess(json.message);
      onClose();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Gagal menyelesaikan iklan");
    } finally {
      setCompleting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-lg font-semibold">Iklan Reward</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {session?.provider === "sandbox"
            ? "Mode demo: simulasi menonton iklan"
            : "Tonton iklan sampai selesai untuk mendapatkan kredit"}
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : session ? (
          <div className="mt-6 space-y-4">
            <div
              className={cn(
                "flex aspect-video flex-col items-center justify-center rounded-xl border-2 border-dashed",
                watching ? "border-primary bg-primary/5" : "border-muted bg-muted/30"
              )}
            >
              {!watching ? (
                <>
                  <Play className="mb-2 h-10 w-10 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    +{session.creditsPerAd} kredit setelah selesai
                  </p>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold tabular-nums text-primary">
                    {remaining}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    detik tersisa...
                  </p>
                </>
              )}
            </div>

            {!watching ? (
              <Button className="w-full" variant="brand" onClick={startWatch}>
                <Play className="mr-2 h-4 w-4" />
                Mulai Tonton
              </Button>
            ) : (
              <Button
                className="w-full"
                variant="brand"
                disabled={remaining > 0 || completing}
                onClick={completeWatch}
              >
                {completing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {remaining > 0
                  ? `Tunggu ${remaining} detik...`
                  : "Klaim Kredit"}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
