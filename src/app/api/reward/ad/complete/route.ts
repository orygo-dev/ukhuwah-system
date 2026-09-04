import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getRewardConfig } from "@/lib/reward";
import { getRewardAdConfig } from "@/lib/reward-ad";
import { completeRewardAdSession } from "@/lib/reward-ad-service";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";

const schema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Iklan reward hanya tersedia untuk akun guru.");
  }

  const rewardConfig = await getRewardConfig();
  if (!rewardConfig.enabled) {
    return NextResponse.json({ error: "Program reward tidak aktif" }, { status: 400 });
  }

  const adConfig = await getRewardAdConfig();
  if (!adConfig.enabled) {
    return NextResponse.json({ error: "Iklan reward tidak aktif" }, { status: 400 });
  }

  if (adConfig.provider !== "sandbox") {
    return NextResponse.json(
      { error: "Mode AdMob diverifikasi otomatis via server" },
      { status: 400 }
    );
  }

  try {
    const { sessionId } = schema.parse(await req.json());
    const result = await completeRewardAdSession({
      sessionId,
      userId: session.user.id,
      provider: "sandbox",
    });

    return NextResponse.json({
      message: `+${result.credits} kredit dari iklan reward`,
      creditsAwarded: result.credits,
      creditsRemaining: result.balanceAfter,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Gagal";
    const map: Record<string, string> = {
      SESSION_NOT_FOUND: "Sesi iklan tidak ditemukan",
      SESSION_NOT_PENDING: "Sesi iklan sudah diproses",
      SESSION_EXPIRED: "Sesi iklan kedaluwarsa, mulai ulang",
      WATCH_TOO_SHORT: "Tonton iklan sampai selesai",
      DAILY_LIMIT_REACHED: "Kuota iklan hari ini sudah habis",
      ALREADY_REWARDED: "Hadiah sudah pernah diklaim",
    };
    return NextResponse.json(
      { error: map[msg] || "Gagal menyelesaikan iklan" },
      { status: 400 }
    );
  }
}
