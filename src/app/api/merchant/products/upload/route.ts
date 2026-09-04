import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMerchantRole } from "@/lib/api-role-guard";
import { storeObject, deleteStoredObject } from "@/lib/object-storage";
import { detectImageMime } from "@/lib/image-signature";

export const runtime = "nodejs";

const IMAGE_MAX = 5 * 1024 * 1024;
const FILE_MAX = 20 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await prisma.merchantStore.findUnique({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });

  const form = await req.formData();
  const kind = String(form.get("kind") || "image");
  const productId = String(form.get("productId") || "");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "File wajib diunggah" }, { status: 400 });
  }

  if (kind === "image") {
    if (file.size > IMAGE_MAX) return NextResponse.json({ error: "Gambar maksimal 5 MB" }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = detectImageMime(bytes);
    if (!mime) return NextResponse.json({ error: "Format gambar tidak valid" }, { status: 400 });
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    const stored = await storeObject({
      folder: "market/covers",
      extension: ext,
      bytes,
      contentType: mime,
      namePrefix: store.id.slice(-6),
    });
    const url = stored.key.startsWith("uploads/") ? `/${stored.key}` : stored.url;
    return NextResponse.json({ url });
  }

  if (kind === "digital") {
    if (!productId) return NextResponse.json({ error: "Produk wajib dipilih" }, { status: 400 });
    const product = await prisma.marketplaceProduct.findFirst({
      where: { id: productId, storeId: store.id },
    });
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    if (product.kind !== "BOOK_DIGITAL") {
      return NextResponse.json({ error: "File digital hanya untuk buku digital" }, { status: 400 });
    }
    if (file.size > FILE_MAX) return NextResponse.json({ error: "File digital maksimal 20 MB" }, { status: 400 });
    const name = file.name.toLowerCase();
    if (!/\.(pdf|epub|zip)$/.test(name)) {
      return NextResponse.json({ error: "Gunakan PDF, EPUB, atau ZIP" }, { status: 400 });
    }
    const ext = name.split(".").pop() || "pdf";
    const bytes = Buffer.from(await file.arrayBuffer());
    if (product.digitalFileKey) await deleteStoredObject(product.digitalFileKey);
    const stored = await storeObject({
      folder: "market/digital",
      extension: ext,
      bytes,
      contentType: file.type || "application/octet-stream",
      namePrefix: product.id.slice(-8),
    });
    await prisma.marketplaceProduct.update({
      where: { id: product.id },
      data: { digitalFileKey: stored.key, digitalFileName: file.name.slice(0, 120) },
    });
    return NextResponse.json({ ok: true, fileName: file.name });
  }

  return NextResponse.json({ error: "Jenis unggahan tidak dikenal" }, { status: 400 });
}
