import { NextResponse } from "next/server";
import { Prisma, TkaScope } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageTka, getTkaActor } from "@/lib/tka";

type Params = { params: Promise<{ id: string }> };
const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ARCHIVE") }), z.object({ action: z.literal("DUPLICATE") }),
  z.object({ action: z.literal("UPDATE"), title: z.string().trim().min(3).max(180), description: z.string().trim().max(3000).optional(), durationMinutes: z.coerce.number().int().min(5).max(180), startsAt: z.string().datetime().nullable().optional(), endsAt: z.string().datetime().nullable().optional(), showDiscussion: z.boolean().optional(), questionIds: z.array(z.string().min(1)).min(1).max(100) }),
]);

function packageAccess(actor: Awaited<ReturnType<typeof getTkaActor>>) {
  if (actor.role === "SUPER_ADMIN") return { scope: TkaScope.GLOBAL };
  if (actor.role === "SCHOOL_ADMIN") return { scope: TkaScope.SCHOOL, schoolId: actor.schoolId ?? "__none__" };
  return { scope: TkaScope.CLASS, authorId: actor.id };
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const actor = await getTkaActor(session); const { id } = await params;
    const body = updateSchema.parse(await req.json().catch(() => null));
    const current = await prisma.tkaPackage.findFirst({ where: { id, ...packageAccess(actor) }, include: { questions: true, _count: { select: { attempts: true } } } });
    if (!current) return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
    if (body.action === "ARCHIVE") { const item = await prisma.tkaPackage.update({ where: { id }, data: { status: "ARCHIVED" } }); return NextResponse.json({ package: item }); }
    if (body.action === "DUPLICATE") {
      const item = await prisma.tkaPackage.create({ data: { subjectId: current.subjectId, authorId: actor.id, schoolId: current.schoolId, classRoomId: current.classRoomId, title: `${current.title} (Salinan)`, description: current.description, scope: current.scope, status: "DRAFT", durationMinutes: current.durationMinutes, startsAt: null, endsAt: null, showDiscussion: current.showDiscussion, questions: { create: current.questions.map((link) => ({ questionId: link.questionId, sortOrder: link.sortOrder })) } } });
      return NextResponse.json({ package: item });
    }
    if (current._count.attempts > 0) return NextResponse.json({ error: "Paket yang sudah dikerjakan siswa tidak dapat diubah. Duplikasi paket untuk membuat revisi." }, { status: 409 });
    const ids = [...new Set(body.questionIds)];
    const count = await prisma.tkaQuestion.count({ where: { id: { in: ids }, subjectId: current.subjectId, scope: current.scope, status: "PUBLISHED", ...(current.scope === TkaScope.CLASS ? { authorId: current.authorId, classRoomId: current.classRoomId } : {}), ...(current.scope === TkaScope.SCHOOL ? { schoolId: current.schoolId } : {}) } });
    if (count !== ids.length) return NextResponse.json({ error: "Pilihan soal tidak sesuai mapel atau cakupan paket." }, { status: 400 });
    const startsAt = body.startsAt ? new Date(body.startsAt) : null; const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
    const item = await prisma.$transaction(async (tx) => {
      const latest = await tx.tkaAttempt.count({ where: { packageId: id } });
      if (latest > 0) throw new Error("TKA_PACKAGE_LOCKED");
      await tx.tkaPackageQuestion.deleteMany({ where: { packageId: id } });
      await tx.tkaPackageQuestion.createMany({ data: ids.map((questionId, sortOrder) => ({ packageId: id, questionId, sortOrder })) });
      return tx.tkaPackage.update({ where: { id }, data: { title: body.title, description: body.description || null, durationMinutes: body.durationMinutes, startsAt, endsAt, showDiscussion: body.showDiscussion ?? true, status: "PUBLISHED", publishedAt: current.publishedAt ?? new Date() } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ package: item });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.errors[0]?.message ?? "Data tidak valid" }, { status: 400 });
    if (error instanceof Error && error.message === "TKA_PACKAGE_LOCKED") return NextResponse.json({ error: "Paket mulai dikerjakan saat diperbarui. Perubahan dibatalkan; duplikasi paket untuk revisi." }, { status: 409 });
    console.error("[tka package PATCH]", error); return NextResponse.json({ error: "Gagal memperbarui paket TKA." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth(); if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const actor = await getTkaActor(session); const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.tkaPackage.findFirst({ where: { id, ...packageAccess(actor) }, select: { id: true } }); if (!current) return null;
    const attempts = await tx.tkaAttempt.count({ where: { packageId: id } });
    if (attempts > 0) { await tx.tkaPackage.update({ where: { id }, data: { status: "ARCHIVED" } }); return "archived" as const; }
    await tx.tkaPackage.delete({ where: { id } }); return "deleted" as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!result) return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  return NextResponse.json(result === "archived" ? { archived: true } : { deleted: true });
}
