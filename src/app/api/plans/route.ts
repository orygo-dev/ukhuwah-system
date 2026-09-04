import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    plans: plans.map((p) => ({
      ...p,
      priceMonthly: Number(p.priceMonthly),
      priceYearly: Number(p.priceYearly),
    })),
  });
}
