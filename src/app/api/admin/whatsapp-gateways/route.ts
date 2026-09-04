import { NextResponse } from "next/server";
import { z } from "zod";
import {
  WhatsAppGatewayProvider,
  WhatsAppMessagePurpose,
  type WhatsAppGateway,
} from "@prisma/client";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  getWhatsAppTemplates,
  maskSecret,
  saveWhatsAppTemplates,
  sendWhatsAppMessage,
  type WhatsAppTemplateMap,
} from "@/lib/whatsapp";

const gatewaySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nama gateway wajib diisi"),
  provider: z.nativeEnum(WhatsAppGatewayProvider),
  baseUrl: z.string().trim().optional().nullable(),
  token: z.string().optional().nullable(),
  sender: z.string().optional().nullable(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  isSandbox: z.boolean(),
});

const templateSchema = z.record(
  z.nativeEnum(WhatsAppMessagePurpose),
  z.object({
    enabled: z.boolean(),
    title: z.string().min(1),
    message: z.string().min(1),
  })
);

const testSchema = z.object({
  gatewayId: z.string().optional(),
  target: z.string().trim().min(8),
  message: z.string().trim().min(1),
});

function clean(value?: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

function serializeGateway(gateway: WhatsAppGateway) {
  return {
    id: gateway.id,
    name: gateway.name,
    provider: gateway.provider,
    baseUrl: gateway.baseUrl,
    sender: gateway.sender,
    isActive: gateway.isActive,
    isDefault: gateway.isDefault,
    isSandbox: gateway.isSandbox,
    tokenMasked: maskSecret(gateway.token),
    hasToken: Boolean(gateway.token),
    createdAt: gateway.createdAt.toISOString(),
    updatedAt: gateway.updatedAt.toISOString(),
  };
}

async function payload() {
  const [gateways, templates, logs] = await Promise.all([
    prisma.whatsAppGateway.findMany({
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    }),
    getWhatsAppTemplates(),
    prisma.whatsAppMessageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        gateway: { select: { name: true, provider: true } },
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    providers: Object.values(WhatsAppGatewayProvider),
    purposes: Object.values(WhatsAppMessagePurpose),
    defaults: DEFAULT_WHATSAPP_TEMPLATES,
    gateways: gateways.map(serializeGateway),
    templates,
    logs: logs.map((log) => ({
      id: log.id,
      gatewayName: log.gateway?.name || "-",
      provider: log.gateway?.provider || null,
      userName: log.user?.name || null,
      userEmail: log.user?.email || null,
      purpose: log.purpose,
      target: log.target,
      status: log.status,
      error: log.error,
      createdAt: log.createdAt.toISOString(),
      sentAt: log.sentAt?.toISOString() || null,
    })),
  };
}

function adminError(err: unknown) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.errors[0]?.message || "Data tidak valid" },
      { status: 400 }
    );
  }
  const msg = err instanceof Error ? err.message : "Forbidden";
  if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ error: msg || "Gagal memproses" }, { status: 500 });
}

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json(await payload());
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json().catch(() => ({}));
    const action = z
      .enum(["save-gateway", "delete-gateway", "save-templates", "test-send"])
      .parse(body.action);

    if (action === "save-gateway") {
      const parsed = gatewaySchema.parse(body.gateway);
      const isDefault = parsed.isDefault;
      const isActive = parsed.isActive || isDefault;
      await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.whatsAppGateway.updateMany({ data: { isDefault: false } });
        }
        if (parsed.id) {
          const current = await tx.whatsAppGateway.findUnique({ where: { id: parsed.id } });
          const nextToken = clean(parsed.token) || current?.token || null;
          if (isActive && !nextToken) {
            throw new Error("WHATSAPP_TOKEN_REQUIRED");
          }
          await tx.whatsAppGateway.update({
            where: { id: parsed.id },
            data: {
              name: parsed.name.trim(),
              provider: parsed.provider,
              baseUrl: clean(parsed.baseUrl),
              token: nextToken,
              sender: clean(parsed.sender),
              isActive,
              isDefault,
              isSandbox: parsed.isSandbox,
            },
          });
        } else {
          const nextToken = clean(parsed.token);
          if (isActive && !nextToken) {
            throw new Error("WHATSAPP_TOKEN_REQUIRED");
          }
          await tx.whatsAppGateway.create({
            data: {
              name: parsed.name.trim(),
              provider: parsed.provider,
              baseUrl: clean(parsed.baseUrl),
              token: nextToken,
              sender: clean(parsed.sender),
              isActive,
              isDefault,
              isSandbox: parsed.isSandbox,
            },
          });
        }
      });
      return NextResponse.json(await payload());
    }

    if (action === "delete-gateway") {
      const id = z.string().min(1).parse(body.id);
      await prisma.$transaction(async (tx) => {
        const current = await tx.whatsAppGateway.findUnique({
          where: { id },
          select: { isDefault: true },
        });
        await tx.whatsAppGateway.delete({ where: { id } });
        if (current?.isDefault) {
          const fallback = await tx.whatsAppGateway.findFirst({
            where: { isActive: true },
            orderBy: { updatedAt: "desc" },
          });
          if (fallback) {
            await tx.whatsAppGateway.update({
              where: { id: fallback.id },
              data: { isDefault: true },
            });
          }
        }
      });
      return NextResponse.json(await payload());
    }

    if (action === "save-templates") {
      const templates = templateSchema.parse(body.templates) as Partial<WhatsAppTemplateMap>;
      await saveWhatsAppTemplates(templates);
      return NextResponse.json(await payload());
    }

    const parsed = testSchema.parse(body);
    await sendWhatsAppMessage({
      target: parsed.target,
      purpose: "TEST",
      gatewayId: parsed.gatewayId,
      messageOverride: parsed.message,
      variables: { name: "Admin", appName: "Navalogi" },
    });
    return NextResponse.json(await payload());
  } catch (err) {
    if (err instanceof Error && err.message === "WHATSAPP_TOKEN_REQUIRED") {
      return NextResponse.json(
        { error: "Token/API key wajib diisi sebelum gateway WhatsApp diaktifkan." },
        { status: 400 }
      );
    }
    return adminError(err);
  }
}
