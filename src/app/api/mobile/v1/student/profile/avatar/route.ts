import path from "path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import { storeObject } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { publicStoredUploadUrl } from "@/lib/upload-url";
import { detectImageMime } from "@/lib/image-signature";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";

const maxFileSize = 3 * 1024 * 1024;
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const mimeByExt: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  if (requestBodyTooLarge(req, maxFileSize + 512 * 1024)) {
    return bodyTooLargeResponse("Ukuran foto maksimal 3 MB.");
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Pilih foto profil terlebih dahulu." },
        { status: 400 }
      );
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      return NextResponse.json(
        { error: "Foto harus berformat JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > maxFileSize) {
      return NextResponse.json(
        { error: "Ukuran foto maksimal 3 MB." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const canonicalMime = detectImageMime(bytes);
    if (!canonicalMime || canonicalMime !== mimeByExt[extension]) {
      return NextResponse.json(
        { error: "Isi file tidak sesuai dengan format gambar yang dipilih." },
        { status: 400 }
      );
    }

    const stored = await storeObject({
      folder: "avatars",
      extension: extension.replace(/^\./, ""),
      bytes,
      contentType: canonicalMime,
      namePrefix: session.user.id,
    });

    // Persist raw storage URL; expose same-origin /api/media path to clients.
    await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl: stored.url },
    });

    return NextResponse.json({
      ok: true,
      avatarUrl: publicStoredUploadUrl(stored),
      storage: stored.driver,
      message: "Foto profil berhasil diperbarui.",
    });
  } catch (error) {
    console.error("[student avatar POST]", error);
    return NextResponse.json(
      { error: "Foto profil belum dapat disimpan." },
      { status: 500 }
    );
  }
}
