import { NextResponse } from "next/server";
import { MarketplaceProductKind } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMerchantRole } from "@/lib/api-role-guard";
import { serializeMoney } from "@/lib/marketplace";
import { deleteStoredObject } from "@/lib/object-storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  kind: z.nativeEnum(MarketplaceProductKind).optional(),
  price: z.number().int().min(1000).max(50_000_000).optional(),
  stock: z.number().int().min(0).max(100_000).optional(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  submit: z.boolean().optional(),
  archive: z.boolean().optional(),
});

async function ownedProduct(userId: string, id: string) {
  const store = await prisma.merchantStore.findUnique({ where: { userId } });
  if (!store) return null;
  return prisma.marketplaceProduct.findFirst({ where: { id, storeId: store.id } });
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const product = await ownedProduct(session.user.id, id);
  if (!product) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    product: {
      ...product,
      price: serializeMoney(product.price),
      hasDigitalFile: Boolean(product.digitalFileKey),
      digitalFileKey: undefined,
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const product = await ownedProduct(session.user.id, id);
  if (!product) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  const body = patchSchema.parse(await req.json().catch(() => null));
  let status = product.status;
  if (body.archive) status = "ARCHIVED";
  else if (body.submit) {
    if ((body.kind ?? product.kind) === "BOOK_DIGITAL" && !product.digitalFileKey) {
      return NextResponse.json({ error: "Unggah file digital sebelum review." }, { status: 400 });
    }
    status = "PENDING_REVIEW";
  }
  else if (product.status === "PUBLISHED" && (body.title || body.price || body.kind)) {
    status = "PENDING_REVIEW";
  }
  const updated = await prisma.marketplaceProduct.update({
    where: { id: product.id },
    data: {
      title: body.title ?? product.title,
      description: body.description === undefined ? product.description : body.description,
      kind: body.kind ?? product.kind,
      price: body.price ?? product.price,
      stock: body.stock ?? product.stock,
      imageUrl: body.imageUrl === undefined ? product.imageUrl : body.imageUrl,
      status,
    },
  });
  return NextResponse.json({
    product: {
      ...updated,
      price: serializeMoney(updated.price),
      hasDigitalFile: Boolean(updated.digitalFileKey),
      digitalFileKey: undefined,
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const product = await ownedProduct(session.user.id, id);
  if (!product) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  if (product.status === "PUBLISHED") {
    return NextResponse.json({ error: "Produk terbit tidak bisa dihapus. Arsipkan saja." }, { status: 400 });
  }
  await deleteStoredObject(product.digitalFileKey);
  await prisma.marketplaceProduct.delete({ where: { id: product.id } });
  return NextResponse.json({ ok: true });
}
