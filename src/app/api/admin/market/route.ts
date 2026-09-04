import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getMarketplaceCommissionPercent,
  saveMarketplaceCommissionPercent,
  serializeMoney,
} from "@/lib/marketplace";

export const runtime = "nodejs";

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

export async function GET() {
  if (!(await assertSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [stores, products, commissionPercent] = await Promise.all([
    prisma.merchantStore.findMany({
      include: {
        user: { select: { email: true, name: true } },
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.marketplaceProduct.findMany({
      include: {
        store: { select: { name: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
    getMarketplaceCommissionPercent(),
  ]);
  return NextResponse.json({
    commissionPercent,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      status: store.status,
      city: store.city,
      rejectionNote: store.rejectionNote,
      ownerName: store.user.name,
      ownerEmail: store.user.email,
      productCount: store._count.products,
      createdAt: store.createdAt,
    })),
    products: products.map((product) => ({
      id: product.id,
      title: product.title,
      kind: product.kind,
      status: product.status,
      price: serializeMoney(product.price),
      stock: product.stock,
      hasDigitalFile: Boolean(product.digitalFileKey),
      storeName: product.store.name,
      storeStatus: product.store.status,
      rejectionNote: product.rejectionNote,
    })),
  });
}

export async function PATCH(req: Request) {
  try {
    if (!(await assertSuperAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = z
    .object({
      commissionPercent: z.number().min(0).max(100).optional(),
      storeId: z.string().optional(),
      productId: z.string().optional(),
      action: z.enum(["approve", "reject", "suspend"]).optional(),
      note: z.string().trim().max(500).optional(),
    })
    .parse(await req.json().catch(() => null));

  if (typeof body.commissionPercent === "number") {
    const commissionPercent = await saveMarketplaceCommissionPercent(body.commissionPercent);
    return NextResponse.json({ ok: true, commissionPercent });
  }

  if (body.storeId && body.action) {
    const store = await prisma.merchantStore.findUnique({ where: { id: body.storeId } });
    if (!store) return NextResponse.json({ error: "Toko tidak ditemukan" }, { status: 404 });
    const status =
      body.action === "approve" ? "ACTIVE" : body.action === "suspend" ? "SUSPENDED" : "REJECTED";
    await prisma.merchantStore.update({
      where: { id: store.id },
      data: { status, rejectionNote: body.action === "approve" ? null : body.note || store.rejectionNote },
    });
    return NextResponse.json({ ok: true, status });
  }

  if (body.productId && body.action) {
    const product = await prisma.marketplaceProduct.findUnique({ where: { id: body.productId } });
    if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
    if (body.action === "approve") {
      if (product.kind === "BOOK_DIGITAL" && !product.digitalFileKey) {
        return NextResponse.json({ error: "Buku digital wajib punya file sebelum disetujui." }, { status: 400 });
      }
      await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: { status: "PUBLISHED", rejectionNote: null },
      });
      return NextResponse.json({ ok: true, status: "PUBLISHED" });
    }
    if (body.action === "suspend") {
      await prisma.marketplaceProduct.update({
        where: { id: product.id },
        data: { status: "ARCHIVED" },
      });
      return NextResponse.json({ ok: true, status: "ARCHIVED" });
    }
    await prisma.marketplaceProduct.update({
      where: { id: product.id },
      data: { status: "REJECTED", rejectionNote: body.note || product.rejectionNote },
    });
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan marketplace" }, { status: 500 });
  }
}
