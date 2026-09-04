import { NextResponse } from "next/server";
import { z } from "zod";
import { DocumentStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAssessmentForUser } from "@/lib/grading-access";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  note: z.string().trim().max(500).optional(),
  status: z.nativeEnum(DocumentStatus).optional(),
  records: z
    .array(
      z.object({
        studentId: z.string(),
        score: z.number().min(0).nullable(),
        note: z.string().trim().max(500).optional(),
      })
    )
    .optional(),
});

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data penilaian guru.");
  }

  const { id } = await params;
  const assessment = await getAssessmentForUser(id, session.user);
  if (!assessment) {
    return NextResponse.json({ error: "Penilaian tidak ditemukan" }, { status: 404 });
  }

  const graded = assessment.gradeRecords.filter((r) => r.score != null).length;
  const scores = assessment.gradeRecords
    .map((r) => r.score)
    .filter((s): s is number => s != null);
  const average =
    scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;

  return NextResponse.json({
    assessment,
    summary: { graded, total: assessment.gradeRecords.length, average },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menyimpan nilai.");
  }

  const { id } = await params;
  const existing = await getAssessmentForUser(id, session.user);
  if (!existing || existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Penilaian tidak ditemukan" }, { status: 404 });
  }

  try {
    const body = patchSchema.parse(await req.json());

    if (body.note !== undefined || body.status) {
      await prisma.assessment.update({
        where: { id },
        data: {
          ...(body.note !== undefined ? { note: body.note.trim() || null } : {}),
          ...(body.status ? { status: body.status } : {}),
        },
      });
    }

    if (body.records?.length) {
      const maxScore = existing.maxScore;
      const allowedStudentIds = new Set(existing.gradeRecords.map((r) => r.studentId));
      for (const r of body.records) {
        if (!allowedStudentIds.has(r.studentId)) {
          return NextResponse.json(
            { error: "Data siswa pada nilai tidak sesuai dengan penilaian ini." },
            { status: 400 }
          );
        }
        if (r.score != null && r.score > maxScore) {
          return NextResponse.json(
            { error: `Nilai tidak boleh melebihi ${maxScore}` },
            { status: 400 }
          );
        }
      }

      await prisma.$transaction(
        body.records.map((r) =>
          prisma.gradeRecord.updateMany({
            where: { assessmentId: id, studentId: r.studentId },
            data: {
              score: r.score,
              note: r.note?.trim() || null,
            },
          })
        )
      );
    }

    const assessment = await getAssessmentForUser(id, session.user);
    const graded = assessment!.gradeRecords.filter((r) => r.score != null).length;
    const scores = assessment!.gradeRecords
      .map((r) => r.score)
      .filter((s): s is number => s != null);
    const average =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null;

    return NextResponse.json({
      assessment,
      summary: { graded, total: assessment!.gradeRecords.length, average },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan nilai" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menghapus penilaian.");
  }

  const { id } = await params;
  const existing = await getAssessmentForUser(id, session.user);
  if (!existing || existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Penilaian tidak ditemukan" }, { status: 404 });
  }

  await prisma.assessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
