import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMerchantRole } from "@/lib/api-role-guard";
import { serializeMoney } from "@/lib/marketplace";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  bankName: z.string().trim().max(80).optional().nullable(),
  bankAccount: z.string().trim().max(40).optional().nullable(),
  bankHolder: z.string().trim().max(80).optional().nullable(),
  flatShippingFee: z.number().int().min(0).max(5_000_000),
});

async function merchantStore(userId: string) {
  return prisma.merchantStore.findUnique({ where: { userId } });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
  const store = await merchantStore(session.user.id);
  if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
  const [productCount, pendingOrders] = await Promise.all([
    prisma.marketplaceProduct.count({ where: { storeId: store.id } }),
    prisma.marketplaceSubOrder.count({
      where: { storeId: store.id, status: { in: ["PAID", "READY"] } },
    }),
  ]);
  return NextResponse.json({
    store: {
      ...store,
      flatShippingFee: serializeMoney(store.flatShippingFee),
    },
    stats: { productCount, pendingOrders },
  });
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isMerchantRole(session.user.role)) return forbiddenRoleResponse();
    const store = await merchantStore(session.user.id);
    if (!store) return NextResponse.json({ error: "Toko belum dibuat" }, { status: 404 });
    const body = schema.parse(await req.json().catch(() => null));
    const updated = await prisma.merchantStore.update({
      where: { id: store.id },
      data: {
        name: body.name,
        description: body.description || null,
        address: body.address || null,
        city: body.city || null,
        bankName: body.bankName || null,
        bankAccount: body.bankAccount || null,
        bankHolder: body.bankHolder || null,
        flatShippingFee: body.flatShippingFee,
      },
    });
    return NextResponse.json({
      store: { ...updated, flatShippingFee: serializeMoney(updated.flatShippingFee) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan toko" }, { status: 500 });
  }
}
