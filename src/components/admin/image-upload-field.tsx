"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { UploadKind } from "@/lib/media-upload";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

type ImageUploadFieldProps = {
  label: string;
  hint?: string;
  value: string;
  kind: UploadKind;
  onChange: (url: string) => void;
  previewClassName?: string;
  requireSquare?: boolean;
};

export function ImageUploadField({
  label,
  hint,
  value,
  kind,
  onChange,
  previewClassName = "max-h-48 w-full object-contain",
  requireSquare = false,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [remoteFailed, setRemoteFailed] = useState(false);

  const displaySrc = localPreview || (value ? toSameOriginUploadUrl(value) : "");

  useEffect(() => {
    setRemoteFailed(false);
  }, [displaySrc]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const clearLocalPreview = () => {
    setLocalPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    setRemoteFailed(false);
    clearLocalPreview();
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    try {
      if (requireSquare) {
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => {
            const image = new Image();
            image.onload = () =>
              resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
            image.src = objectUrl;
          }
        );
        if (dimensions.width !== dimensions.height) {
          throw new Error("Ikon harus berbentuk persegi (rasio 1:1).");
        }
      }
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const res = await fetch("/api/admin/media/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah");
      if (!data.url || typeof data.url !== "string") {
        throw new Error("Upload berhasil tetapi URL media tidak dikembalikan.");
      }
      onChange(toSameOriginUploadUrl(data.url));
      clearLocalPreview();
    } catch (e) {
      clearLocalPreview();
      setError(e instanceof Error ? e.message : "Gagal mengunggah");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-1 h-4 w-4" />
          )}
          {value ? "Ganti Gambar" : "Unggah Gambar"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={uploading}
            onClick={() => {
              clearLocalPreview();
              onChange("");
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            Hapus
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {displaySrc ? (
        <div className="overflow-hidden rounded-lg border bg-muted/30 p-2">
          {remoteFailed ? (
            <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-3 py-6 text-center text-sm text-muted-foreground">
              <ImageOff className="h-8 w-8" />
              <p className="font-medium text-slate-700">Preview gagal dimuat</p>
              <p className="break-all text-xs">{displaySrc}</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc}
              alt="Preview"
              className={previewClassName}
              onError={() => setRemoteFailed(true)}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground transition-colors hover:bg-muted/40"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <ImagePlus className="h-8 w-8" />
          )}
          Klik untuk pilih gambar (JPG, PNG, WebP, GIF — maks. 5 MB)
        </button>
      )}
    </div>
  );
}
