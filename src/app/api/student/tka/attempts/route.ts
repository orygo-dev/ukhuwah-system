import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { studentPackageWhere } from "@/lib/tka";

const schema = z.object({ packageId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Hanya siswa yang dapat memulai simulasi." }, { status: 403 });
  try {
    const body = schema.parse(await req.json().catch(() => null));
    const student = await prisma.student.findFirst({
      where: { userId: session.user.id, isActive: true, classRoom: { isActive: true } },
      select: { id: true, classRoomId: true, classRoom: { select: { schoolId: true } } },
    });
    if (!student) return NextResponse.json({ error: "Akun belum terhubung ke roster siswa." }, { status: 404 });
    const item = await prisma.tkaPackage.findFirst({
      where: { id: body.packageId, ...studentPackageWhere(student) },
      include: { _count: { select: { questions: true } } },
    });
    if (!item || item._count.questions === 0) return NextResponse.json({ error: "Simulasi tidak tersedia." }, { status: 404 });
    const now = new Date();
    const attempt = await prisma.tkaAttempt.upsert({
      where: { packageId_studentId: { packageId: item.id, studentId: student.id } },
      update: {},
      create: {
        packageId: item.id,
        studentId: student.id,
        startedAt: now,
        expiresAt: new Date(now.getTime() + item.durationMinutes * 60_000),
        totalQuestions: item._count.questions,
      },
    });
    return NextResponse.json({ attempt });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Paket tidak valid." }, { status: 400 });
    console.error("[tka attempts POST]", error);
    return NextResponse.json({ error: "Gagal memulai simulasi." }, { status: 500 });
  }
}
