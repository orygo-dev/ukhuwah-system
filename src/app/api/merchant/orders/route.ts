import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMerchantRole } from "@/lib/api-role-guard";
import { serializeMoney } from "@/lib/marketplace";

export const runtime = "nodejs";

const patchSchema = z.object({
  courier: z.string().trim().min(2).max(40).optional(),
  trackingNumber: z.string().trim().min(4).max(60).optional(),
  markReady: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await prisma.merchantStore.findUnique({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
  const subOrders = await prisma.marketplaceSubOrder.findMany({
    where: { storeId: store.id, status: { not: "PENDING" } },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          shippingName: true,
          shippingPhone: true,
          shippingAddress: true,
          shippingCity: true,
          createdAt: true,
        },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  return NextResponse.json({
    orders: subOrders.map((row) => ({
      id: row.id,
      status: row.status,
      goodsAmount: serializeMoney(row.goodsAmount),
      shippingAmount: serializeMoney(row.shippingAmount),
      courier: row.courier,
      trackingNumber: row.trackingNumber,
      shippedAt: row.shippedAt,
      order: row.order,
      items: row.items.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        quantity: item.quantity,
        unitPrice: serializeMoney(item.unitPrice),
      })),
    })),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await prisma.merchantStore.findUnique({ where: { userId: session.user.id } });
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
  const body = z
    .object({ id: z.string().min(1) })
    .merge(patchSchema)
    .parse(await req.json().catch(() => null));
  const sub = await prisma.marketplaceSubOrder.findFirst({
    where: { id: body.id, storeId: store.id },
    include: { items: true, order: true },
  });
  if (!sub) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  if (sub.order.status !== "PAID") {
    return NextResponse.json({ error: "Pesanan belum dibayar" }, { status: 400 });
  }
  const hasPhysical = sub.items.some((item) => item.kind !== "BOOK_DIGITAL");
  if (body.markReady && !hasPhysical) {
    await prisma.marketplaceSubOrder.update({
      where: { id: sub.id },
      data: { status: "READY" },
    });
    return NextResponse.json({ ok: true, status: "READY" });
  }
  if (hasPhysical && body.courier && body.trackingNumber) {
    await prisma.marketplaceSubOrder.update({
      where: { id: sub.id },
      data: {
        status: "SHIPPED",
        courier: body.courier,
        trackingNumber: body.trackingNumber,
        shippedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, status: "SHIPPED" });
  }
  return NextResponse.json({ error: "Isi kurir dan resi untuk pengiriman fisik" }, { status: 400 });
}
