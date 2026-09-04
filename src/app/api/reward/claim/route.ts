import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getRewardConfig } from "@/lib/reward";
import { claimRewardMission } from "@/lib/reward-missions";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

const schema = z.object({
  missionSlug: z.string().min(1),
});

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Reward kredit hanya tersedia untuk akun guru.");
  }

  const config = await getRewardConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "Program reward sedang tidak aktif" },
      { status: 400 }
    );
  }

  try {
    const { missionSlug } = schema.parse(await req.json());
    const result = await claimRewardMission(session.user.id, missionSlug);

    return NextResponse.json({
      message: `+${result.credits} kredit dari misi "${result.missionTitle}"`,
      creditsAwarded: result.credits,
      creditsRemaining: result.balanceAfter,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Gagal klaim";
    if (msg === "ALREADY_CLAIMED" || isUniqueConstraintError(err)) {
      return NextResponse.json({ error: "Misi sudah diklaim" }, { status: 409 });
    }
    if (msg === "MISSION_NOT_FOUND") {
      return NextResponse.json({ error: "Misi tidak ditemukan" }, { status: 404 });
    }
    if (msg === "MISSION_LOCKED") {
      return NextResponse.json(
        { error: "Syarat misi belum terpenuhi" },
        { status: 400 }
      );
    }
    if (msg === "USE_AD_FLOW") {
      return NextResponse.json(
        { error: "Gunakan tombol Tonton Iklan untuk misi ini" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: msg.startsWith("Lengkapi") || msg.startsWith("Buat") || msg.startsWith("Buka") || msg.startsWith("Iklan") ? msg : "Gagal mengklaim misi" },
      { status: 400 }
    );
  }
}
