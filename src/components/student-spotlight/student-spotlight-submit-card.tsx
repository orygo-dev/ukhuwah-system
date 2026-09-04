"use client";

import { useState } from "react";
import { Clapperboard, Loader2, Send } from "lucide-react";
import {
  SpotlightVideoTrimmer,
  type SpotlightTrimResult,
} from "@/components/student-spotlight/spotlight-video-trimmer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STUDENT_SPOTLIGHT_MAX_SECONDS } from "@/lib/spotlight-video";

type Phase = "idle" | "uploading" | "submitting";

type StudentSpotlightSubmitCardProps = {
  reviewEnabled?: boolean;
};

export function StudentSpotlightSubmitCard({
  reviewEnabled = false,
}: StudentSpotlightSubmitCardProps) {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("GLOBAL");
  const [clip, setClip] = useState<SpotlightTrimResult | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trimmerKey, setTrimmerKey] = useState(0);

  const busy = phase !== "idle";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clip) {
      setError("Pilih video dan tekan “Gunakan potongan ini” terlebih dahulu.");
      return;
    }
    if (caption.trim().length < 10) {
      setError("Caption minimal 10 karakter.");
      return;
    }

    setPhase("uploading");
    setMessage("");
    setError("");
    try {
      const uploadBody = new FormData();
      uploadBody.append("file", clip.file);
      if (clip.thumbnail) {
        uploadBody.append("thumbnail", clip.thumbnail);
      }

      const uploadRes = await fetch("/api/student/spotlight/upload", {
        method: "POST",
        body: uploadBody,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || "Gagal mengunggah video");
      }

      setPhase("submitting");
      const submitRes = await fetch("/api/student/spotlight-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          visibility,
          videoUrl: uploadData.url,
          thumbnailUrl: uploadData.thumbnailUrl || "",
        }),
      });
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.error || "Gagal mengirim Zona Kreasi");
      }

      setCaption("");
      setVisibility("GLOBAL");
      setClip(null);
      setTrimmerKey((value) => value + 1);
      setMessage(
        submitData.reviewEnabled === false
          ? "Zona Kreasi berhasil dikirim dan langsung terbit di feed."
          : "Zona Kreasi berhasil dikirim dan menunggu review guru."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim Zona Kreasi");
    } finally {
      setPhase("idle");
    }
  };

  return (
    <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-950">
            <Clapperboard className="h-4 w-4 text-emerald-600" />
            Kirim Zona Kreasi
          </CardTitle>
          <Badge
            className={
              reviewEnabled
                ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
            }
          >
            Maks. {STUDENT_SPOTLIGHT_MAX_SECONDS} detik ·{" "}
            {reviewEnabled ? "direview guru" : "langsung terbit"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
          <SpotlightVideoTrimmer
            key={trimmerKey}
            disabled={busy}
            onReady={setClip}
          />

          {clip ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
              <video
                key={clip.objectUrl}
                src={clip.objectUrl}
                controls
                playsInline
                poster={clip.posterUrl || undefined}
                className="mx-auto max-h-56 w-full object-contain"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Tampil Untuk</Label>
            <Select
              value={visibility}
              onValueChange={setVisibility}
              disabled={busy}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Publik — semua siswa</SelectItem>
                <SelectItem value="SCHOOL">Sekolah saya</SelectItem>
                <SelectItem value="CLASS">Kelas saya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={4}
              placeholder="Ceritakan karya, kegiatan, atau prestasi yang ingin ditampilkan."
              required
              minLength={10}
              disabled={busy}
            />
          </div>

          <Button type="submit" disabled={busy || !clip} className="rounded-xl">
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {phase === "uploading"
              ? "Mengunggah video..."
              : phase === "submitting"
                ? "Mengirim..."
                : "Terbitkan Zona Kreasi"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
