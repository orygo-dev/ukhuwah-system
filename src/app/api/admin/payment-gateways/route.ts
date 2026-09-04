import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export const runtime = "nodejs";

const PAYMENT_GATEWAY_NAMES: Record<string, string> = {
  midtrans: "Midtrans",
  tripay: "Tripay",
  flip: "Flip Business",
  ipaymu: "iPaymu",
};

const REQUIRED_CONFIG_KEYS: Record<string, string[]> = {
  midtrans: ["serverKey", "clientKey"],
  tripay: ["apiKey", "privateKey", "merchantCode"],
  flip: ["apiKey", "validationToken"],
  ipaymu: ["va", "apiKey"],
};

const gatewaySchema = z.object({
  slug: z.string().trim().toLowerCase(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isSandbox: z.boolean().optional(),
  config: z.record(z.string()).optional().default({}),
  supportedMethods: z.array(z.string()).optional().default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateways = await prisma.paymentGateway.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    gateways: gateways.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      isActive: g.isActive,
      isDefault: g.isDefault,
      isSandbox: g.isSandbox,
      supportedMethods: g.supportedMethods,
      hasConfig: Object.keys(g.config as object).length > 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = gatewaySchema.parse(await req.json().catch(() => ({})));
    const slug = body.slug;
    if (!PAYMENT_GATEWAY_NAMES[slug]) {
      return NextResponse.json({ error: "Payment gateway tidak valid" }, { status: 400 });
    }
    const isDefault = Boolean(body.isDefault);
    const isActive = Boolean(body.isActive) || isDefault;
    const supportedMethods = body.supportedMethods;

    const existing = await prisma.paymentGateway.findUnique({
      where: { slug },
    });

    const config: Record<string, string> = {};
    const incoming = body.config;
    const existingConfig = (existing?.config || {}) as Record<string, string>;

    for (const key of Object.keys(incoming)) {
      const value = incoming[key];
      if (value && !value.includes("••••") && value.trim()) {
        config[key] = encrypt(value.trim());
      }
    }

    const mergedConfig = { ...existingConfig, ...config };
    if (isActive) {
      const missingKeys = (REQUIRED_CONFIG_KEYS[slug] || []).filter((key) => !mergedConfig[key]);
      if (missingKeys.length > 0) {
        return NextResponse.json(
          {
            error: `Lengkapi konfigurasi ${PAYMENT_GATEWAY_NAMES[slug]} sebelum mengaktifkan: ${missingKeys.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    const gateway = await prisma.paymentGateway.upsert({
      where: { slug },
      create: {
        name: PAYMENT_GATEWAY_NAMES[slug],
        slug,
        isActive,
        isDefault,
        isSandbox: body.isSandbox ?? true,
        config: mergedConfig,
        supportedMethods,
      },
      update: {
        name: PAYMENT_GATEWAY_NAMES[slug],
        isActive,
        isDefault,
        isSandbox: body.isSandbox,
        config: mergedConfig,
        supportedMethods,
      },
    });

    if (isDefault) {
      await prisma.paymentGateway.updateMany({
        where: { id: { not: gateway.id } },
        data: { isDefault: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message || "Data gateway tidak valid" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
