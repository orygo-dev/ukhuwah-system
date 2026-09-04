import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  token: z.string().trim().min(40).max(512),
  platform: z.enum(["ANDROID", "IOS", "WEB"]),
  appId: z.string().trim().min(3).max(160),
  deviceName: z.string().trim().max(255).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Token push tidak valid." }, { status: 400 });
  }
  const userAgent = request.headers.get("user-agent")?.slice(0, 1000) || null;
  const device = await prisma.pushDeviceToken.upsert({
    where: { token: parsed.data.token },
    create: {
      userId: session.user.id,
      token: parsed.data.token,
      platform: parsed.data.platform,
      appId: parsed.data.appId,
      deviceName: parsed.data.deviceName || null,
      userAgent,
    },
    update: {
      userId: session.user.id,
      platform: parsed.data.platform,
      appId: parsed.data.appId,
      deviceName: parsed.data.deviceName || null,
      userAgent,
      active: true,
      lastSeenAt: new Date(),
    },
    select: { id: true, platform: true, appId: true, active: true },
  });
  return NextResponse.json({ device });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z
    .object({ token: z.string().trim().min(40).max(512) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Token push tidak valid." }, { status: 400 });
  }
  await prisma.pushDeviceToken.updateMany({
    where: { userId: session.user.id, token: parsed.data.token },
    data: { active: false },
  });
  return NextResponse.json({ ok: true });
}
