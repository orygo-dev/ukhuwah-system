import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";
import { getPublicReelsAdsPayload, trackReelsAdEvent } from "@/lib/reels-ads";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTeacherWorkspaceRole(session.user.role)) {
      return forbiddenRoleResponse("Reels ads hanya tersedia di workspace guru.");
    }
    const payload = await getPublicReelsAdsPayload();
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[spotlight reels-ads GET]", err);
    return NextResponse.json({ error: "Gagal memuat" }, { status: 500 });
  }
}

const eventSchema = z.object({
  adId: z.string().trim().min(1).max(120),
  event: z.enum(["impression", "click"]),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTeacherWorkspaceRole(session.user.role)) {
      return forbiddenRoleResponse("Reels ads hanya tersedia di workspace guru.");
    }
    const body = eventSchema.parse(await req.json());
    await trackReelsAdEvent(body.adId, body.event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    console.error("[spotlight reels-ads POST]", err);
    return NextResponse.json({ error: "Gagal mencatat" }, { status: 500 });
  }
}
