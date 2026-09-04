import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { saveAppDisplayImage, type UploadKind } from "@/lib/media-upload";

export const runtime = "nodejs";

const kindSchema = z.enum([
  "logo",
  "auth-logo",
  "banner",
  "desktop-banner",
  "popup",
  "reels-ad",
  "quick-menu-icon",
  "splash-logo",
  "splash-background",
]);

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const form = await req.formData();
    const file = form.get("file");
    const kindRaw = form.get("kind");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File gambar wajib diunggah" }, { status: 400 });
    }

    const kind = kindSchema.parse(
      typeof kindRaw === "string" ? kindRaw : "banner"
    ) as UploadKind;

    const url = await saveAppDisplayImage(file, kind);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Jenis upload tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: msg || "Gagal mengunggah gambar" },
      { status: 400 }
    );
  }
}
