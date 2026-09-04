import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAssignmentWorkbook } from "@/lib/assignment-workbook";
import { bodyTooLargeResponse, requestBodyTooLarge } from "@/lib/request-body-limit";
import { prisma } from "@/lib/prisma";
import { canManageTka, defaultScopeForRole, getTkaActor, teacherOwnsClass } from "@/lib/tka";
import { parseTkaQuestionSheet } from "@/lib/tka-question-import";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
function errorResponse(errors: Array<{ row: number; message: string }>) {
  return NextResponse.json(
    { error: "Impor dibatalkan. Perbaiki baris yang disebutkan; belum ada soal yang disimpan.", errors },
    { status: 422 },
  );
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageTka(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (requestBodyTooLarge(req, MAX_FILE_BYTES + 512 * 1024)) return bodyTooLargeResponse("File XLSX maksimal 5 MB.");

  try {
    const actor = await getTkaActor(session);
    const form = await req.formData();
    const file = form.get("file");
    const subjectId = String(form.get("subjectId") || "").trim();
    const classRoomId = String(form.get("classRoomId") || "").trim() || null;
    if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES || !file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ error: "Pilih template XLSX maksimal 5 MB." }, { status: 400 });
    }
    const subject = subjectId
      ? await prisma.tkaSubject.findFirst({ where: { id: subjectId, isActive: true }, select: { id: true } })
      : null;
    if (!subject) return NextResponse.json({ error: "Mata pelajaran tidak valid atau tidak aktif." }, { status: 400 });

    const scope = defaultScopeForRole(actor.role);
    if (scope === "CLASS" && (!classRoomId || !(await teacherOwnsClass(actor.id, classRoomId)))) {
      return NextResponse.json({ error: "Kelas tidak ditemukan atau bukan kelas Anda." }, { status: 403 });
    }
    if (scope === "SCHOOL" && !actor.schoolId) {
      return NextResponse.json({ error: "Akun belum terhubung ke sekolah." }, { status: 400 });
    }

    const workbook = await loadAssignmentWorkbook(new Uint8Array(await file.arrayBuffer()));
    const sheet = workbook.getWorksheet("Soal");
    if (!sheet) return NextResponse.json({ error: "Sheet Soal tidak ditemukan. Gunakan template resmi Navalogi." }, { status: 400 });

    const { drafts, errors } = parseTkaQuestionSheet(sheet);
    if (errors.length) return errorResponse(errors);

    const questions = await prisma.$transaction(async (tx) => Promise.all(drafts.map((draft) => tx.tkaQuestion.create({
      data: {
        ...draft,
        authorId: actor.id,
        subjectId,
        classRoomId: scope === "CLASS" ? classRoomId : null,
        schoolId: scope === "SCHOOL" ? actor.schoolId : null,
        scope,
        status: "DRAFT",
      },
      include: { subject: true, classRoom: { select: { id: true, name: true } }, author: { select: { name: true } } },
    }))));

    return NextResponse.json({ questions, imported: questions.length }, { status: 201 });
  } catch (error) {
    console.error("[tka question import]", error);
    return NextResponse.json({ error: "Template tidak dapat dibaca. Pastikan file berasal dari template resmi dan tidak rusak." }, { status: 400 });
  }
}
