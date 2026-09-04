import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import {
  DEFAULT_LANDING_PAGE,
  getLandingPageConfig,
  mergeLandingPage,
  saveLandingPageConfig,
  type LandingPageConfig,
} from "@/lib/landing-page";

export const runtime = "nodejs";

import { landingPageSchema } from "@/lib/landing-page.schema";

export async function GET() {
  try {
    await requireSuperAdmin();
    const config = await getLandingPageConfig();
    return NextResponse.json({ config, defaults: DEFAULT_LANDING_PAGE });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

    if (body.action === "reset") {
      const config = await saveLandingPageConfig(DEFAULT_LANDING_PAGE);
      revalidatePath("/");
      return NextResponse.json({ config });
    }

    const current = await getLandingPageConfig();
    // Older editors do not know the additive experience fields; preserve them.
    const parsed = landingPageSchema.parse({
      ...body,
      schemaVersion: body.schemaVersion ?? current.schemaVersion,
      experience: body.experience ?? current.experience,
    }) as LandingPageConfig;
    const config = await saveLandingPageConfig(parsed);
    revalidatePath("/");
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[landing-page PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    const current = await getLandingPageConfig();
    const merged = mergeLandingPage(current, body.patch ?? body);
    const parsed = landingPageSchema.parse(merged) as LandingPageConfig;
    const config = await saveLandingPageConfig(parsed);
    revalidatePath("/");
    return NextResponse.json({ config });
  } catch (err) {
    if (err instanceof SyntaxError)
      return NextResponse.json({ error: "JSON tidak valid" }, { status: 400 });
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 },
      );
    }
    const msg = err instanceof Error ? err.message : "Forbidden";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
