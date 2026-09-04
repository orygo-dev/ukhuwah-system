import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  getPushNotificationPublicConfig,
  savePushNotificationConfig,
} from "@/lib/push-notification-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const configSchema = z.object({
  enabled: z.boolean(),
  provider: z.literal("FCM").optional(),
  projectId: z.string().trim().max(200).optional().default(""),
  serverKey: z
    .string()
    .trim()
    .max(20_000, "File JSON service account terlalu besar atau tidak valid.")
    .optional(),
  androidChannelId: z.string().trim().max(80).optional().default("genpro_default"),
  webApiKey: z.string().trim().max(500).optional(),
  webAuthDomain: z.string().trim().max(500).optional(),
  webMessagingSenderId: z.string().trim().max(200).optional(),
  webAppId: z.string().trim().max(500).optional(),
  webVapidKey: z.string().trim().max(1000).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({
      config: await getPushNotificationPublicConfig(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat pengaturan" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const input = configSchema.parse(await req.json().catch(() => null));
    const config = await savePushNotificationConfig(input, session.user.id);
    return NextResponse.json({
      config,
      message: config.enabled
        ? "Push notifikasi diaktifkan. Pengiriman ke perangkat Android akan memakai konfigurasi ini."
        : "Pengaturan push notifikasi disimpan.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: msg || "Gagal menyimpan" }, { status: 400 });
  }
}
