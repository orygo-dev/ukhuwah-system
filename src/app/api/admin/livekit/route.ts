import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getLiveKitPublicConfig,
  saveLiveKitConfig,
  testLiveKitConnection,
} from "@/lib/livekit";
import { PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS } from "@/lib/pjj-capacity";

export const runtime = "nodejs";

const configSchema = z
  .object({
    enabled: z.boolean(),
    provider: z.enum(["SELF_HOSTED", "CLOUD"]),
    wsUrl: z.string().trim().max(500),
    apiUrl: z.string().trim().max(500).optional().default(""),
    apiKey: z.string().trim().max(500).optional(),
    apiSecret: z.string().trim().max(1000).optional(),
    recordingEnabled: z.boolean(),
    maxParticipants: z
      .number()
      .int()
      .min(2)
      .max(PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS),
  })
  .superRefine((data, context) => {
    if (data.wsUrl && !/^wss?:\/\//i.test(data.wsUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wsUrl"],
        message: "WebSocket URL harus diawali ws:// atau wss://.",
      });
    }
    if (data.apiUrl && !/^https?:\/\//i.test(data.apiUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiUrl"],
        message: "API URL harus diawali http:// atau https://.",
      });
    }
  });

async function requireAdmin() {
  const session = await auth();
  return session?.user.role === "SUPER_ADMIN" ? session : null;
}
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ config: await getLiveKitPublicConfig() });
}

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const input = configSchema.parse(await request.json());
    const config = await saveLiveKitConfig(input, session.user.id);
    return NextResponse.json({ config, message: "Pengaturan LiveKit tersimpan." });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message || "Konfigurasi tidak valid."
        : error instanceof Error
          ? error.message
          : "Gagal menyimpan konfigurasi LiveKit.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await testLiveKitConnection());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Koneksi LiveKit gagal.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
