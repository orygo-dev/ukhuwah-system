import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePushCredential } from "@/lib/push-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireSuperAdmin();
    const check = await validatePushCredential();
    const studentAndroidDevices = await prisma.pushDeviceToken.count({
      where: {
        active: true,
        platform: "ANDROID",
        user: { role: "STUDENT" },
      },
    });
    const latestStudentDevice = await prisma.pushDeviceToken.findFirst({
      where: {
        active: true,
        platform: "ANDROID",
        user: { role: "STUDENT" },
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        appId: true,
        deviceName: true,
        lastSeenAt: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (check.valid) {
      return NextResponse.json({
        ok: true,
        message:
          studentAndroidDevices === 0
            ? "Koneksi Firebase valid. Belum ada perangkat Android siswa aktif untuk menerima push."
            : `Koneksi Firebase valid. Ada ${studentAndroidDevices} perangkat Android siswa aktif untuk pengujian push.`,
        projectId: check.projectId,
        stats: {
          studentAndroidDevices,
        },
        latestStudentDevice,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: check.error || "Kredensial tidak valid.",
        projectId: check.projectId,
      },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memvalidasi.";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[validate push]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
