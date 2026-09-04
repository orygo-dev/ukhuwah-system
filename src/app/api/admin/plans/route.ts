import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

async function assertSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") return null;
  return session;
}

const featuresSchema = z.object({
  export_pdf: z.boolean().default(true),
  export_docx: z.boolean().default(true),
  can_use_ai_assistant: z.boolean().default(true),
  can_use_affiliate: z.boolean().default(true),
  can_use_premium_generators: z.boolean().default(true),
  max_generate_per_month: z.coerce.number().int().min(0).nullable().optional(),
  max_classes: z.coerce.number().int().min(0).nullable().optional(),
  max_students: z.coerce.number().int().min(0).nullable().optional(),
  allowed_generators: z.array(z.string()).default([]),
  monthly_credit_bonus: z.coerce.number().int().min(0).default(0),
  priority: z.boolean().default(false),
});

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nama paket wajib diisi"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug wajib diisi")
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  description: z.string().trim().optional().nullable(),
  priceMonthly: z.coerce.number().min(0),
  priceYearly: z.coerce.number().min(0),
  creditsMonthly: z.coerce.number().int().min(0),
  isActive: z.boolean(),
  isPopular: z.boolean(),
  sortOrder: z.coerce.number().int().min(0),
  features: featuresSchema,
});

function serializePlan(plan: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: Prisma.Decimal;
  priceYearly: Prisma.Decimal;
  creditsMonthly: number;
  features: Prisma.JsonValue | null;
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...plan,
    priceMonthly: Number(plan.priceMonthly),
    priceYearly: Number(plan.priceYearly),
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function isKnownMissingRecordError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2025"
  );
}

export async function GET() {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ plans: plans.map(serializePlan) });
}

export async function POST(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = planSchema.parse(await req.json().catch(() => ({})));
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        creditsMonthly: input.creditsMonthly,
        features: input.features,
        isActive: input.isActive,
        isPopular: input.isPopular,
        sortOrder: input.sortOrder,
      },
    });

    return NextResponse.json({ success: true, plan: serializePlan(plan) });
  } catch (err) {
    console.error("Plan create error:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data paket tidak valid" },
        { status: 400 }
      );
    }
    if (isUniqueConstraintError(err)) {
      return NextResponse.json(
        { error: "Slug paket sudah digunakan. Gunakan slug lain." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membuat paket" },
      { status: 400 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const input = planSchema.extend({ id: z.string().min(1) }).parse(await req.json().catch(() => ({})));
    const plan = await prisma.subscriptionPlan.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description || null,
        priceMonthly: input.priceMonthly,
        priceYearly: input.priceYearly,
        creditsMonthly: input.creditsMonthly,
        features: input.features,
        isActive: input.isActive,
        isPopular: input.isPopular,
        sortOrder: input.sortOrder,
      },
    });

    return NextResponse.json({ success: true, plan: serializePlan(plan) });
  } catch (err) {
    console.error("Plan update error:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data paket tidak valid" },
        { status: 400 }
      );
    }
    if (isUniqueConstraintError(err)) {
      return NextResponse.json(
        { error: "Slug paket sudah digunakan. Gunakan slug lain." },
        { status: 409 }
      );
    }
    if (isKnownMissingRecordError(err)) {
      return NextResponse.json(
        { error: "Paket langganan tidak ditemukan." },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memperbarui paket" },
      { status: 400 }
    );
  }
}
