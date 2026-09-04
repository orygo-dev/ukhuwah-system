import { NextResponse } from "next/server";
import { MarketplaceProductKind } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { productPublicDto } from "@/lib/marketplace";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const kind = searchParams.get("kind");
  const kindFilter =
    kind && Object.values(MarketplaceProductKind).includes(kind as MarketplaceProductKind)
      ? (kind as MarketplaceProductKind)
      : undefined;

  const products = await prisma.marketplaceProduct.findMany({
    where: {
      status: "PUBLISHED",
      store: { status: "ACTIVE" },
      ...(kindFilter ? { kind: kindFilter } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } },
              { store: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      store: { select: { id: true, name: true, city: true, flatShippingFee: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  return NextResponse.json({ products: products.map(productPublicDto) });
}
