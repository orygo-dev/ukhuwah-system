import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendNotificationPush, validatePushCredential } from "@/lib/push-notifications";
import { isPushNotificationEnabled } from "@/lib/push-notification-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireSuperAdmin();
    if (!(await isPushNotificationEnabled())) {
      return NextResponse.json(
        { error: "Aktifkan dan lengkapi konfigurasi Firebase terlebih dahulu." },
        { status: 409 }
      );
    }

    const targetDevice = await prisma.pushDeviceToken.findFirst({
      where: {
        active: true,
        platform: "ANDROID",
        user: { role: "STUDENT" },
      },
      orderBy: { lastSeenAt: "desc" },
      select: {
        userId: true,
        appId: true,
        deviceName: true,
        lastSeenAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!targetDevice) {
      const validation = await validatePushCredential();
      if (!validation.valid) {
        return NextResponse.json(
          {
            error:
              validation.error ||
              "Kredensial Firebase tidak dapat diverifikasi. Periksa kembali service account JSON dan Project ID.",
          },
          { status: 409 }
        );
      }
      const androidCount = await prisma.pushDeviceToken.count({
        where: {
          active: true,
          platform: "ANDROID",
          user: { role: "STUDENT" },
        },
      });
      return NextResponse.json(
        {
          warning: true,
          validated: true,
          message:
            "Koneksi Firebase valid, tetapi belum ada perangkat Android siswa yang aktif untuk menerima notifikasi uji.",
          steps: [
            "Login ke aplikasi Android siswa (Navalogi) menggunakan akun siswa yang valid.",
            "Pastikan izin notifikasi di Android diaktifkan, lalu buka aplikasi sampai dashboard tampil agar token perangkat tersinkron ke server.",
            "Setelah ada perangkat siswa aktif, klik kembali tombol Kirim notifikasi uji.",
          ],
          stats: {
            targetStudentDevices: androidCount,
          },
        },
        { status: 200 }
      );
    }

    const now = new Date();
    const notification = await prisma.notification.create({
      data: {
        senderId: session.user.id,
        title: "Tes Push Navalogi",
        message: "Konfigurasi Firebase berhasil mengirim notifikasi ke perangkat Android siswa.",
        category: "GENERAL",
        priority: "IMPORTANT",
        status: "PUBLISHED",
        targetType: "ROLE",
        targetRole: "STUDENT",
        targetLabel: `Tes Android siswa (${targetDevice.user.name})`,
        actionUrl: "/notifications",
        publishAt: now,
        publishedAt: now,
        recipients: { create: [{ userId: targetDevice.userId }] },
      },
      select: { id: true },
    });
    const result = await sendNotificationPush(notification.id, {
      platform: "ANDROID",
      appId: "com.genpro.app",
    });
    if (result.sent === 0) {
      const validation = await validatePushCredential();
      return NextResponse.json(
        {
          error: `FCM tidak mengirim ke perangkat mana pun. ${result.failed} token gagal.${
            validation.valid
              ? " Koneksi Firebase valid — kemungkinan token Android siswa sudah expired. Coba logout lalu login kembali pada aplikasi siswa."
              : " Selain itu, koneksi Firebase bermasalah: " + (validation.error || "")
          }`,
          result,
          credentialValid: validation.valid,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({
      message: `Notifikasi uji berhasil dikirim ke ${result.sent} perangkat Android siswa. Target terbaru: ${targetDevice.user.name}${targetDevice.user.email ? ` (${targetDevice.user.email})` : ""}.`,
      result,
      target: {
        userId: targetDevice.userId,
        name: targetDevice.user.name,
        email: targetDevice.user.email,
        appId: targetDevice.appId,
        deviceName: targetDevice.deviceName,
        lastSeenAt: targetDevice.lastSeenAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengirim notifikasi uji.";
    if (message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[test push]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
