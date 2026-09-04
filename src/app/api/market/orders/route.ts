import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { serializeMoney } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();

  const orders = await prisma.marketplaceOrder.findMany({
    where: { buyerId: session.user.id },
    include: {
      items: true,
      subOrders: { select: { id: true, status: true, courier: true, trackingNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      amount: serializeMoney(order.amount),
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      titles: order.items.map((item) => item.title).slice(0, 3),
      subOrders: order.subOrders,
    })),
  });
}
