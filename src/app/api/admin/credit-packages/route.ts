import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const packageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().trim().optional().nullable(),
  credits: z.coerce.number().int().min(1).max(100000),
  bonusCredits: z.coerce.number().int().min(0).max(100000),
  price: z.coerce.number().min(1000).max(100000000),
  isActive: z.boolean(),
  isPopular: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const packages = await prisma.creditPackage.findMany({
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });
    return NextResponse.json({
      packages: packages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        price: Number(pkg.price),
        isActive: pkg.isActive,
        isPopular: pkg.isPopular,
        sortOrder: pkg.sortOrder,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    return NextResponse.json(
      { error: msg === "UNAUTHORIZED" ? "Unauthorized" : "Forbidden" },
      { status: msg === "UNAUTHORIZED" ? 401 : 403 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const data = packageSchema.parse(await req.json().catch(() => ({})));

    const duplicateSlug = await prisma.creditPackage.findFirst({
      where: {
        slug: data.slug,
        ...(data.id ? { id: { not: data.id } } : {}),
      },
      select: { id: true },
    });
    if (duplicateSlug) {
      return NextResponse.json(
        { error: "Slug paket kredit sudah digunakan paket lain" },
        { status: 409 }
      );
    }

    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      credits: data.credits,
      bonusCredits: data.bonusCredits,
      price: data.price,
      isActive: data.isActive,
      isPopular: data.isPopular,
      sortOrder: data.sortOrder,
    };

    const saved = data.id
      ? await prisma.creditPackage.update({
          where: { id: data.id },
          data: payload,
        })
      : await prisma.creditPackage.create({
          data: payload,
        });

    return NextResponse.json({
      package: {
        ...saved,
        price: Number(saved.price),
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Gagal menyimpan";
    const isKnownMissingRecord = typeof err === "object" && err !== null && "code" in err && err.code === "P2025";
    return NextResponse.json(
      { error: isKnownMissingRecord ? "Paket kredit tidak ditemukan" : msg },
      { status: isKnownMissingRecord ? 404 : 500 }
    );
  }
}
