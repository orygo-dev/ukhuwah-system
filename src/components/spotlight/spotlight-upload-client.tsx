"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Upload, Video } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isDirectVideoUrl, videoUrlHint } from "@/lib/spotlight-video";

const SAMPLE_VIDEOS = [
  {
    label: "Sample 1",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    label: "Sample 2",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

export function SpotlightUploadClient() {
  const { data: session } = useSession();
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [previewOk, setPreviewOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!videoUrl.trim()) {
      setPreviewOk(null);
      return;
    }
    setPreviewOk(isDirectVideoUrl(videoUrl));
  }, [videoUrl]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirectVideoUrl(videoUrl)) {
      setError(videoUrlHint());
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/spotlight/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah");
      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/spotlight");
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell
      activePath="/dashboard/spotlight"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/dashboard/spotlight">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali ke Zona Kreasi
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Buat Zona Kreasi</h1>
          <p className="text-muted-foreground">
            Video pendek vertikal atau horizontal — tips mengajar, trik administrasi, atau inspirasi kelas.
          </p>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Zona Kreasi berhasil dipublikasikan! Mengalihkan...
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4" />
              Unggah Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>URL Video (MP4 / WebM langsung)</Label>
                <Input
                  type="url"
                  placeholder="https://contoh.com/video.mp4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{videoUrlHint()}</p>
                {previewOk === false && (
                  <p className="text-xs text-destructive">
                    URL tidak valid. Jangan gunakan link YouTube/Instagram/TikTok.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_VIDEOS.map((s) => (
                    <Button
                      key={s.url}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setVideoUrl(s.url)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              {previewOk && videoUrl && (
                <div className="overflow-hidden rounded-xl border bg-black">
                  <video
                    key={videoUrl}
                    src={videoUrl}
                    controls
                    playsInline
                    className="mx-auto max-h-64 w-full object-contain"
                  />
                  <p className="bg-secondary px-3 py-1.5 text-center text-xs text-muted-foreground">
                    Pratinjau video
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Caption</Label>
                  <span className="text-xs text-muted-foreground">
                    {caption.length}/2000
                  </span>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Ceritakan tips atau inspirasi Anda..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  required
                  maxLength={2000}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                variant="brand"
                disabled={saving || success || previewOk === false}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Publikasikan Zona Kreasi
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
