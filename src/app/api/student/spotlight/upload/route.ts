import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeObject } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const MAX_THUMB_BYTES = 2 * 1024 * 1024;

const videoTypes = new Map([
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/webm", "webm"],
]);

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const videoContentTypes = new Map([
  ["mp4", "video/mp4"],
  ["mov", "video/quicktime"],
  ["webm", "video/webm"],
]);

const imageContentTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

function extensionFromName(name: string) {
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function hasValidImageSignature(bytes: Buffer, extension: string) {
  if (extension === "jpg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return bytes.length >= 12 && bytes.subarray(8, 12).toString("ascii") === "WEBP";
}

function hasValidVideoSignature(bytes: Buffer, extension: string) {
  if (extension === "webm") {
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya akun siswa yang dapat mengunggah Zona Kreasi." },
      { status: 403 }
    );
  }
  if (requestBodyTooLarge(req, MAX_VIDEO_BYTES + MAX_THUMB_BYTES + 1024 * 1024)) {
    return bodyTooLargeResponse("Ukuran total unggahan melebihi batas yang diizinkan.");
  }

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      classRoom: { select: { isActive: true } },
    },
  });
  if (!student) {
    return NextResponse.json(
      { error: "Akun siswa belum terhubung ke data siswa." },
      { status: 404 }
    );
  }
  if (!student.classRoom.isActive) {
    return NextResponse.json(
      { error: "Kelas sudah tidak aktif dan tidak dapat menerima Zona Kreasi baru." },
      { status: 400 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Pilih gambar atau video terlebih dahulu." }, { status: 400 });
    }

    // Dio/Android can send gallery files as application/octet-stream. Fall
    // back to the original filename, then verify the real file signature below.
    const nameExtension = extensionFromName(file.name);
    const videoExtension =
      videoTypes.get(file.type) ??
      (videoContentTypes.has(nameExtension) ? nameExtension : undefined);
    const rawImageExtension =
      imageTypes.get(file.type) ??
      (imageContentTypes.has(nameExtension) ? nameExtension : undefined);
    const imageExtension = rawImageExtension === "jpeg" ? "jpg" : rawImageExtension;
    const extension = videoExtension ?? imageExtension;
    if (!extension) {
      return NextResponse.json(
        { error: "Format harus MP4, MOV, WebM, JPEG, PNG, atau WebP." },
        { status: 400 }
      );
    }
    const maxBytes = videoExtension ? MAX_VIDEO_BYTES : MAX_THUMB_BYTES * 5;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: videoExtension ? "Ukuran video maksimal 40 MB." : "Ukuran gambar maksimal 10 MB." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const validSignature = videoExtension
      ? hasValidVideoSignature(bytes, extension)
      : hasValidImageSignature(bytes, extension);
    if (!validSignature) {
      return NextResponse.json(
        { error: "Isi file tidak sesuai dengan format yang dipilih." },
        { status: 400 }
      );
    }

    const stored = await storeObject({
      folder: "spotlight",
      extension,
      bytes,
      contentType:
        videoContentTypes.get(extension) ??
        imageContentTypes.get(extension) ??
        file.type,
    });

    let thumbnailUrl: string | null = null;
    const thumb = form.get("thumbnail");
    if (thumb instanceof File && thumb.size > 0) {
      const thumbExt = imageTypes.get(thumb.type);
      if (!thumbExt) {
        return NextResponse.json(
          { error: "Thumbnail harus berupa JPEG, PNG, atau WebP." },
          { status: 400 }
        );
      }
      if (thumb.size > MAX_THUMB_BYTES) {
        return NextResponse.json(
          { error: "Ukuran thumbnail maksimal 2 MB." },
          { status: 400 }
        );
      }
      const thumbBytes = Buffer.from(await thumb.arrayBuffer());
      if (!hasValidImageSignature(thumbBytes, thumbExt)) {
        return NextResponse.json(
          { error: "Isi thumbnail tidak sesuai dengan format gambar yang dipilih." },
          { status: 400 }
        );
      }
      const thumbStored = await storeObject({
        folder: "spotlight",
        extension: thumbExt,
        bytes: thumbBytes,
        contentType: imageContentTypes.get(thumbExt)!,
      });
      thumbnailUrl = thumbStored.url;
    }

    return NextResponse.json({
      url: stored.url,
      thumbnailUrl,
      name: file.name,
      size: file.size,
      mediaType: videoExtension ? "video" : "image",
      storage: stored.driver,
    });
  } catch (error) {
    console.error("[student spotlight upload POST]", error);
    return NextResponse.json({ error: "Gagal mengunggah media Zona Kreasi." }, { status: 500 });
  }
}
