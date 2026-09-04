import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "TEACHER" && session.user.role !== "SUPER_ADMIN") {
    return forbiddenRoleResponse("Hanya pembuat tugas yang dapat menduplikasi tugas.");
  }
  const { id } = await params;
  const source = await prisma.assignment.findFirst({
    where: { id, ...(session.user.role === "SUPER_ADMIN" ? {} : { teacherId: session.user.id }) },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Tugas tidak ditemukan" }, { status: 404 });
  const duplicate = await prisma.assignment.create({
    data: {
      classRoomId: source.classRoomId,
      teacherId: session.user.role === "SUPER_ADMIN" ? source.teacherId : session.user.id,
      title: `${source.title} (Salinan)`,
      mapel: source.mapel,
      description: source.description,
      dueDate: source.dueDate,
      dueAt: source.dueAt,
      status: "DRAFT",
      mode: source.mode,
      maxScore: source.maxScore,
      allowLate: source.allowLate,
      allowResubmit: source.allowResubmit,
      questions: source.questions.length ? {
        create: source.questions.map((question) => ({
          type: question.type,
          prompt: question.prompt,
          imageUrl: question.imageUrl,
          options: question.options ?? undefined,
          correctAnswer: question.correctAnswer ?? undefined,
          points: question.points,
          required: question.required,
          explanation: question.explanation,
          sortOrder: question.sortOrder,
        })),
      } : undefined,
    },
  });
  return NextResponse.json({ assignment: duplicate }, { status: 201 });
}
