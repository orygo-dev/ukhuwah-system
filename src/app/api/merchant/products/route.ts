import { NextResponse } from "next/server";
import { MarketplaceProductKind } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMerchantRole } from "@/lib/api-role-guard";
import { serializeMoney, uniqueProductSlug } from "@/lib/marketplace";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional().nullable(),
  kind: z.nativeEnum(MarketplaceProductKind),
  price: z.number().int().min(1000).max(50_000_000),
  stock: z.number().int().min(0).max(100_000),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  submit: z.boolean().optional(),
});

async function storeOf(userId: string) {
  return prisma.merchantStore.findUnique({ where: { userId } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await storeOf(session.user.id);
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
  const products = await prisma.marketplaceProduct.findMany({
    where: { storeId: store.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    storeStatus: store.status,
    products: products.map((p) => ({
      ...p,
      price: serializeMoney(p.price),
      hasDigitalFile: Boolean(p.digitalFileKey),
      digitalFileKey: undefined,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await storeOf(session.user.id);
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
  const body = createSchema.parse(await req.json().catch(() => null));
  if (body.submit && body.kind === "BOOK_DIGITAL") {
    return NextResponse.json(
      { error: "Unggah file digital dulu, lalu kirim produk untuk review." },
      { status: 400 },
    );
  }
  const slug = await uniqueProductSlug(store.id, body.title);
  const product = await prisma.marketplaceProduct.create({
    data: {
      storeId: store.id,
      title: body.title,
      slug,
      description: body.description || null,
      kind: body.kind,
      price: body.price,
      stock: body.stock,
      imageUrl: body.imageUrl || null,
      status: body.submit ? "PENDING_REVIEW" : "DRAFT",
    },
  });
  return NextResponse.json({
    product: { ...product, price: serializeMoney(product.price), digitalFileKey: undefined },
  });
}
