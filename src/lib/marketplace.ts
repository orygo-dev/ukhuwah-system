import "server-only";
import type { Prisma } from "@prisma/client";
import {
  MarketplaceBuyerType,
  MarketplaceProductKind,
  type UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MARKETPLACE_CONFIG_KEY = "marketplace_config";
export const DEFAULT_MARKETPLACE_COMMISSION_PERCENT = 5;
export const CHECKOUT_READY_GATEWAYS = new Set(["midtrans", "tripay"]);

export function isMarketplaceBuyerRole(role: UserRole) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN";
}

export function marketplaceBuyerType(role: UserRole): MarketplaceBuyerType | null {
  if (role === "SCHOOL_ADMIN") return MarketplaceBuyerType.SCHOOL;
  if (role === "TEACHER" || role === "SUPER_ADMIN") return MarketplaceBuyerType.TEACHER;
  return null;
}

export function isPhysicalKind(kind: MarketplaceProductKind) {
  return kind === "BOOK_PHYSICAL" || kind === "STATIONERY";
}

export function slugifyMarket(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || `item-${Date.now().toString(36)}`;
}

export async function uniqueStoreSlug(name: string) {
  const base = slugifyMarket(name);
  let slug = base;
  let n = 1;
  while (await prisma.merchantStore.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function uniqueProductSlug(storeId: string, title: string) {
  const base = slugifyMarket(title);
  let slug = base;
  let n = 1;
  while (
    await prisma.marketplaceProduct.findUnique({
      where: { storeId_slug: { storeId, slug } },
    })
  ) {
    n += 1;
    slug = `${base}-${n}`;
  }
  return slug;
}

export async function getMarketplaceCommissionPercent() {
  const row = await prisma.platformSetting.findUnique({
    where: { key: MARKETPLACE_CONFIG_KEY },
  });
  const value = row?.value as { commissionPercent?: unknown } | null;
  const percent = Number(value?.commissionPercent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return DEFAULT_MARKETPLACE_COMMISSION_PERCENT;
  }
  return percent;
}

export async function saveMarketplaceCommissionPercent(commissionPercent: number) {
  const safe = Math.min(100, Math.max(0, Math.round(commissionPercent * 100) / 100));
  await prisma.platformSetting.upsert({
    where: { key: MARKETPLACE_CONFIG_KEY },
    create: {
      key: MARKETPLACE_CONFIG_KEY,
      value: { commissionPercent: safe },
    },
    update: { value: { commissionPercent: safe } },
  });
  return safe;
}

export function serializeMoney(value: Prisma.Decimal | number | string) {
  return Math.round(Number(value));
}

export function productPublicDto(product: {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  kind: MarketplaceProductKind;
  price: Prisma.Decimal | number;
  stock: number;
  imageUrl: string | null;
  store: { id: string; name: string; city: string | null; flatShippingFee: Prisma.Decimal | number };
}) {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    kind: product.kind,
    price: serializeMoney(product.price),
    stock: product.stock,
    imageUrl: product.imageUrl,
    physical: isPhysicalKind(product.kind),
    store: {
      id: product.store.id,
      name: product.store.name,
      city: product.store.city,
      shippingFee: serializeMoney(product.store.flatShippingFee),
    },
  };
}
