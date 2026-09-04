import { prisma } from "@/lib/prisma";
import { isPhysicalKind } from "@/lib/marketplace";

async function restoreHeldStock(orderId: string) {
  const items = await prisma.marketplaceOrderItem.findMany({
    where: { orderId },
    select: { productId: true, quantity: true, kind: true },
  });
  for (const item of items) {
    if (!isPhysicalKind(item.kind)) continue;
    await prisma.marketplaceProduct.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}

export async function activateMarketplaceOrder(
  orderId: string,
  paymentMethod?: string,
) {
  const marked = await prisma.marketplaceOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: {
      status: "PAID",
      paidAt: new Date(),
    },
  });
  if (marked.count !== 1) return false;

  const order = await prisma.marketplaceOrder.findUnique({
    where: { id: orderId },
    include: { items: true, subOrders: true },
  });
  if (!order) return false;

  await prisma.marketplaceSubOrder.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "PAID" },
  });

  const productIds = [...new Set(order.items.map((item) => item.productId))];
  if (productIds.length > 0) {
    await prisma.marketplaceCartItem.deleteMany({
      where: { userId: order.buyerId, productId: { in: productIds } },
    });
  }

  if (paymentMethod) {
    const current = (order.metadata as Record<string, unknown> | null) || {};
    await prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: { metadata: { ...current, paymentMethod } },
    });
  }

  return true;
}

export async function failMarketplaceOrder(
  orderId: string,
  status: "FAILED" | "EXPIRED" | "CANCELLED",
) {
  const marked = await prisma.marketplaceOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status },
  });
  if (marked.count !== 1) return false;
  await prisma.marketplaceSubOrder.updateMany({
    where: { orderId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  await restoreHeldStock(orderId);
  return true;
}
