import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const packages = await prisma.creditPackage.findMany({
    where: { isActive: true },
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
      totalCredits: pkg.credits + pkg.bonusCredits,
      price: Number(pkg.price),
      isPopular: pkg.isPopular,
    })),
  });
}
