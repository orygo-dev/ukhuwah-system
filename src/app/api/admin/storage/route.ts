import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { getActiveStorageDriver, testR2Connection } from "@/lib/object-storage";
import { getR2PublicConfig, saveR2Config } from "@/lib/r2-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const configSchema = z.object({
  enabled: z.boolean(),
  accountId: z.string().trim().max(120).optional().default(""),
  bucket: z.string().trim().max(120).optional().default(""),
  publicBaseUrl: z.string().trim().max(500).optional().default(""),
  accessKeyId: z.string().trim().max(500).optional(),
  secretAccessKey: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const [config, driver] = await Promise.all([
      getR2PublicConfig(),
      getActiveStorageDriver(),
    ]);
    return NextResponse.json({ config, activeDriver: driver });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat pengaturan storage" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSuperAdmin();
    const input = configSchema.parse(await req.json().catch(() => null));
    const config = await saveR2Config(input, session.user.id);
    const activeDriver = await getActiveStorageDriver();
    return NextResponse.json({
      config,
      activeDriver,
      message: config.enabled
        ? "Cloudflare R2 aktif. Upload baru akan disimpan di R2."
        : "Pengaturan storage disimpan. Upload memakai penyimpanan lokal server.",
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

export async function POST() {
  try {
    await requireSuperAdmin();
    const result = await testR2Connection();
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
