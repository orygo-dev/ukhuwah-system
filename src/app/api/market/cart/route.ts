import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { isPhysicalKind, productPublicDto, serializeMoney } from "@/lib/marketplace";

export const runtime = "nodejs";

const upsertSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

function cartItemDto(item: {
  id: string;
  quantity: number;
  product: Parameters<typeof productPublicDto>[0] & { status: string };
}) {
  return {
    id: item.id,
    quantity: item.quantity,
    product: productPublicDto(item.product),
    lineTotal: serializeMoney(item.product.price) * item.quantity,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const items = await prisma.marketplaceCartItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: { store: { select: { id: true, name: true, city: true, flatShippingFee: true, status: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const available = items.filter(
    (item) => item.product.status === "PUBLISHED" && item.product.store.status === "ACTIVE",
  );
  const storeIds = new Set<string>();
  let goods = 0;
  let shipping = 0;
  for (const item of available) {
    goods += serializeMoney(item.product.price) * item.quantity;
    if (isPhysicalKind(item.product.kind) && !storeIds.has(item.product.store.id)) {
      storeIds.add(item.product.store.id);
      shipping += serializeMoney(item.product.store.flatShippingFee);
    }
  }
  return NextResponse.json({
    items: available.map(cartItemDto),
    summary: { goods, shipping, total: goods + shipping, count: available.length },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const body = upsertSchema.parse(await req.json().catch(() => null));
  const product = await prisma.marketplaceProduct.findFirst({
    where: { id: body.productId, status: "PUBLISHED", store: { status: "ACTIVE" } },
  });
  if (!product) return NextResponse.json({ error: "Produk tidak tersedia" }, { status: 404 });
  if (isPhysicalKind(product.kind) && product.stock < body.quantity) {
    return NextResponse.json({ error: "Stok tidak mencukupi" }, { status: 400 });
  }
  const item = await prisma.marketplaceCartItem.upsert({
    where: { userId_productId: { userId: session.user.id, productId: product.id } },
    create: {
      userId: session.user.id,
      productId: product.id,
      storeId: product.storeId,
      quantity: body.quantity,
    },
    update: { quantity: body.quantity },
  });
  return NextResponse.json({ ok: true, id: item.id });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const body = z
    .object({
      id: z.string().min(1),
      quantity: z.number().int().min(0).max(99),
    })
    .parse(await req.json().catch(() => null));
  const existing = await prisma.marketplaceCartItem.findFirst({
    where: { id: body.id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
  if (body.quantity === 0) {
    await prisma.marketplaceCartItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true, deleted: true });
  }
  await prisma.marketplaceCartItem.update({
    where: { id: existing.id },
    data: { quantity: body.quantity },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib" }, { status: 400 });
  await prisma.marketplaceCartItem.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
