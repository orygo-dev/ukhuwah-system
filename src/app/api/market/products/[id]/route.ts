import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { productPublicDto } from "@/lib/marketplace";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const { id } = await params;
  const product = await prisma.marketplaceProduct.findFirst({
    where: { id, status: "PUBLISHED", store: { status: "ACTIVE" } },
    include: {
      store: { select: { id: true, name: true, city: true, flatShippingFee: true, description: true } },
    },
  });
  if (!product) return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    product: {
      ...productPublicDto(product),
      storeDescription: product.store.description,
    },
  });
}
