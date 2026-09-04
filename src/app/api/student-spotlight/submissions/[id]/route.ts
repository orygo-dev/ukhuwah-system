import { NextResponse } from "next/server";
import {
  StudentBoardVisibility,
  StudentSpotlightSubmissionStatus,
} from "@prisma/client";
import { z } from "zod";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";
import { auth } from "@/lib/auth";
import { getClassRoomForUser } from "@/lib/attendance-access";
import { canReviewContent, getContentReviewSettings } from "@/lib/content-review";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  status: z.enum(["PUBLISHED", "REVISION_REQUESTED", "REJECTED", "ARCHIVED"]),
  reviewNote: z.string().trim().max(2000).optional(),
  visibility: z.nativeEnum(StudentBoardVisibility).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reviewSettings = await getContentReviewSettings();
  if (!canReviewContent(session.user.role, "spotlight", reviewSettings)) {
    return forbiddenRoleResponse("Anda tidak memiliki akses review Zona Kreasi siswa.");
  }

  const { id } = await params;
  try {
    const body = reviewSchema.parse(await req.json().catch(() => null));
    const existing = await prisma.studentSpotlightSubmission.findUnique({
      where: { id },
      include: { classRoom: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Zona Kreasi siswa tidak ditemukan" }, { status: 404 });
    }

    const room = await getClassRoomForUser(existing.classRoomId, session.user);
    if (!room) {
      return NextResponse.json({ error: "Zona Kreasi siswa tidak ditemukan" }, { status: 404 });
    }

    const now = new Date();
    const submission = await prisma.studentSpotlightSubmission.update({
      where: { id },
      data: {
        status: body.status as StudentSpotlightSubmissionStatus,
        ...(body.status === "PUBLISHED" && body.visibility
          ? { visibility: body.visibility }
          : {}),
        reviewNote: body.reviewNote || null,
        reviewerId: session.user.id,
        reviewedAt: now,
        publishedAt:
          body.status === "PUBLISHED" ? existing.publishedAt ?? now : existing.publishedAt,
      },
      include: {
        classRoom: { select: { id: true, name: true, jenjang: true, tahunAjaran: true } },
        student: { select: { id: true, name: true } },
        reviewer: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ submission });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data review tidak valid" },
        { status: 400 }
      );
    }
    console.error("[student spotlight submission PATCH]", err);
    return NextResponse.json({ error: "Gagal memperbarui Zona Kreasi siswa" }, { status: 500 });
  }
}
