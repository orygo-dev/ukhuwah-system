import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { serializeMoney } from "@/lib/marketplace";
import { activateMarketplaceOrder } from "@/lib/payment/activate-market";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const order = await prisma.marketplaceOrder.findFirst({
    where: { id, buyerId: session.user.id },
    include: {
      items: true,
      subOrders: { include: { store: { select: { name: true } } } },
      gateway: { select: { slug: true, isSandbox: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
  const metadata = (order.metadata as Record<string, unknown> | null) || {};
  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      amount: serializeMoney(order.amount),
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      sandbox: order.gateway.isSandbox,
      snapToken: typeof metadata.snapToken === "string" ? metadata.snapToken : undefined,
      redirectUrl: typeof metadata.redirectUrl === "string" ? metadata.redirectUrl : undefined,
      checkoutUrl: typeof metadata.checkoutUrl === "string" ? metadata.checkoutUrl : undefined,
      items: order.items.map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        quantity: item.quantity,
        unitPrice: serializeMoney(item.unitPrice),
        downloadable: order.status === "PAID" && item.kind === "BOOK_DIGITAL" && Boolean(item.digitalFileKey),
      })),
      subOrders: order.subOrders.map((sub) => ({
        id: sub.id,
        status: sub.status,
        storeName: sub.store.name,
        goodsAmount: serializeMoney(sub.goodsAmount),
        shippingAmount: serializeMoney(sub.shippingAmount),
        courier: sub.courier,
        trackingNumber: sub.trackingNumber,
      })),
    },
  });
}

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const order = await prisma.marketplaceOrder.findFirst({
    where: { id, buyerId: session.user.id, status: "PENDING" },
    include: { gateway: true },
  });
  if (!order) return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });

  if (order.gateway.isSandbox && process.env.PAYMENT_AUTO_ACTIVATE_SANDBOX === "true") {
    await activateMarketplaceOrder(order.id, "sandbox_manual");
    return NextResponse.json({ status: "PAID", message: "Sandbox: pesanan marketplace ditandai lunas" });
  }

  return NextResponse.json({ status: order.status });
}
