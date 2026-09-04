import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import {
  CHECKOUT_READY_GATEWAYS,
  getMarketplaceCommissionPercent,
  isPhysicalKind,
  marketplaceBuyerType,
  serializeMoney,
} from "@/lib/marketplace";
import { createMidtransTransaction, getMidtransConfig } from "@/lib/payment/midtrans";
import { createTripayTransaction } from "@/lib/payment/tripay";
import { failMarketplaceOrder } from "@/lib/payment/activate-market";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  shippingName: z.string().trim().min(2).max(80),
  shippingPhone: z.string().trim().min(8).max(20),
  shippingAddress: z.string().trim().min(8).max(500),
  shippingCity: z.string().trim().max(80).optional().nullable(),
});

function profileRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { school: true },
  });
  const profile = profileRecord(user?.profileDefaults);
  const buyerType = marketplaceBuyerType(session.user.role);
  const school = user?.school;
  const shipping =
    buyerType === "SCHOOL" && school
      ? {
          shippingName: user?.name || school.name,
          shippingPhone: user?.phone || "",
          shippingAddress: school.address || "",
          shippingCity: school.city || "",
        }
      : {
          shippingName: String(profile.namaGuru || user?.name || ""),
          shippingPhone: String(profile.phone || user?.phone || ""),
          shippingAddress: String(profile.alamatSekolah || ""),
          shippingCity: String(profile.kota || ""),
        };

  const defaultGateway = await prisma.paymentGateway.findFirst({
    where: { isActive: true, isDefault: true },
  });
  const midtransGateway =
    defaultGateway?.slug === "midtrans"
      ? defaultGateway
      : await prisma.paymentGateway.findFirst({ where: { slug: "midtrans", isActive: true } });
  const midtrans = midtransGateway ? getMidtransConfig(midtransGateway) : null;

  return NextResponse.json({
    buyerType,
    shipping,
    payment: {
      gateway: defaultGateway
        ? { slug: defaultGateway.slug, name: defaultGateway.name, isSandbox: defaultGateway.isSandbox }
        : null,
      midtrans:
        midtrans?.clientKey
          ? { clientKey: midtrans.clientKey, isSandbox: !midtrans.isProduction }
          : null,
    },
  });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
    const buyerType = marketplaceBuyerType(session.user.role);
    if (!buyerType) return forbiddenRoleResponse();

    const body = checkoutSchema.parse(await req.json().catch(() => null));
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, schoolId: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (buyerType === "SCHOOL" && !user.schoolId) {
    return NextResponse.json({ error: "Akun sekolah belum terhubung ke sekolah." }, { status: 400 });
  }

  const cart = await prisma.marketplaceCartItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: { store: true },
      },
    },
  });
  const available = cart.filter(
    (item) => item.product.status === "PUBLISHED" && item.product.store.status === "ACTIVE",
  );
  if (available.length === 0) {
    return NextResponse.json({ error: "Keranjang kosong. Tambah produk sebelum bayar." }, { status: 400 });
  }

  const gateway = await prisma.paymentGateway.findFirst({
    where: { isActive: true, isDefault: true },
  });
  if (!gateway) {
    return NextResponse.json({ error: "Payment gateway belum dikonfigurasi di Super Admin" }, { status: 503 });
  }
  if (!CHECKOUT_READY_GATEWAYS.has(gateway.slug)) {
    return NextResponse.json(
      { error: `${gateway.name} belum mendukung checkout marketplace. Gunakan Midtrans atau Tripay.` },
      { status: 501 },
    );
  }

  const grouped = new Map<string, typeof available>();
  for (const item of available) {
    const list = grouped.get(item.storeId) || [];
    list.push(item);
    grouped.set(item.storeId, list);
  }

  const plans: {
    storeId: string;
    goods: number;
    shipping: number;
    items: typeof available;
  }[] = [];
  let total = 0;
  for (const [storeId, items] of grouped) {
    const store = items[0].product.store;
    let goods = 0;
    let hasPhysical = false;
    for (const item of items) {
      if (isPhysicalKind(item.product.kind)) {
        if (item.product.stock < item.quantity) {
          return NextResponse.json(
            { error: `Stok "${item.product.title}" tidak mencukupi.` },
            { status: 400 },
          );
        }
        hasPhysical = true;
      }
      goods += serializeMoney(item.product.price) * item.quantity;
    }
    const shipping = hasPhysical ? serializeMoney(store.flatShippingFee) : 0;
    total += goods + shipping;
    plans.push({ storeId, goods, shipping, items });
  }
  if (total < 1000) {
    return NextResponse.json({ error: "Total belanja terlalu kecil." }, { status: 400 });
  }

  const orderId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const gatewayRef = `mkt-${orderId}`;
  const commissionPercent = await getMarketplaceCommissionPercent();

  try {
    await prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        for (const item of plan.items) {
          if (!isPhysicalKind(item.product.kind)) continue;
          const held = await tx.marketplaceProduct.updateMany({
            where: {
              id: item.product.id,
              status: "PUBLISHED",
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (held.count !== 1) {
            throw new Error("STOCK");
          }
        }
      }

      await tx.marketplaceOrder.create({
        data: {
          id: orderId,
          buyerId: user.id,
          buyerType,
          schoolId: buyerType === "SCHOOL" ? user.schoolId : null,
          shippingName: body.shippingName,
          shippingPhone: body.shippingPhone,
          shippingAddress: body.shippingAddress,
          shippingCity: body.shippingCity || null,
          amount: total,
          gatewayId: gateway.id,
          gatewayRef,
          metadata: { commissionPercent },
        },
      });

      for (const plan of plans) {
        const sub = await tx.marketplaceSubOrder.create({
          data: {
            orderId,
            storeId: plan.storeId,
            goodsAmount: plan.goods,
            shippingAmount: plan.shipping,
          },
        });
        for (const item of plan.items) {
          await tx.marketplaceOrderItem.create({
            data: {
              orderId,
              subOrderId: sub.id,
              productId: item.product.id,
              kind: item.product.kind,
              title: item.product.title,
              unitPrice: item.product.price,
              quantity: item.quantity,
              digitalFileKey:
                item.product.kind === "BOOK_DIGITAL" ? item.product.digitalFileKey : null,
            },
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "STOCK") {
      return NextResponse.json({ error: "Stok berubah. Muat ulang keranjang." }, { status: 409 });
    }
    console.error("[market checkout]", error);
    return NextResponse.json({ error: "Gagal membuat pesanan" }, { status: 500 });
  }

  try {
    if (gateway.slug === "midtrans") {
      const snap = await createMidtransTransaction(gateway, {
        orderId: gatewayRef,
        amount: total,
        customerName: body.shippingName || user.name || "Pembeli",
        customerEmail: user.email || "buyer@example.com",
        itemName: "Marketplace Navalogi",
      });
      await prisma.marketplaceOrder.update({
        where: { id: orderId },
        data: {
          metadata: {
            commissionPercent,
            snapToken: snap.token,
            redirectUrl: snap.redirect_url,
          },
        },
      });
      return NextResponse.json({
        orderId,
        gateway: "midtrans",
        snapToken: snap.token,
        redirectUrl: snap.redirect_url,
        amount: total,
      });
    }

    const tripay = await createTripayTransaction(gateway, {
      orderId: gatewayRef,
      amount: total,
      customerName: body.shippingName || user.name || "Pembeli",
      customerEmail: user.email || "buyer@example.com",
      itemName: "Marketplace Navalogi",
    });
    await prisma.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        metadata: {
          commissionPercent,
          checkoutUrl: tripay.checkoutUrl,
          providerRef: tripay.reference,
        },
      },
    });
    return NextResponse.json({
      orderId,
      gateway: "tripay",
      checkoutUrl: tripay.checkoutUrl,
      amount: total,
    });
  } catch (error) {
    await failMarketplaceOrder(orderId, "FAILED");
    const message = error instanceof Error ? error.message : "Gagal membuat pembayaran";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Alamat pengiriman tidak lengkap" },
        { status: 400 },
      );
    }
    console.error("[market checkout]", error);
    return NextResponse.json({ error: "Gagal checkout" }, { status: 500 });
  }
}
