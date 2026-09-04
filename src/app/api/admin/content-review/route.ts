import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  getContentReviewSettings,
  upsertContentReviewSettings,
} from "@/lib/content-review";

export const runtime = "nodejs";

const featureSchema = z.object({
  reviewEnabled: z.boolean(),
  reviewerRoles: z
    .array(z.enum(["TEACHER", "SCHOOL_ADMIN"]))
    .min(1, "Minimal satu role reviewer harus dipilih"),
});

const settingsSchema = z.object({
  spotlight: featureSchema,
  mading: featureSchema,
});

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json({ settings: await getContentReviewSettings() });
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
    await requireSuperAdmin();
    const input = settingsSchema.parse(await req.json().catch(() => null));
    const settings = await upsertContentReviewSettings(input);
    return NextResponse.json({
      settings,
      message: "Pengaturan review konten tersimpan.",
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
    return NextResponse.json(
      { error: msg || "Gagal menyimpan pengaturan" },
      { status: 400 }
    );
  }
}
