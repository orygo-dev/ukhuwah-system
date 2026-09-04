import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePjjClass } from "@/lib/pjj";
import { getProvinceAdminScope } from "@/lib/province-scope";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  category: z.string().trim().min(2).max(80).optional(),
  note: z.string().trim().min(3).max(4000).optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  resolve: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    !["TEACHER", "SCHOOL_ADMIN", "PROVINCE_ADMIN", "SUPER_ADMIN"].includes(
      session.user.role
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const input = patchSchema.parse(await req.json().catch(() => null));
    const existing = await prisma.pjjIntervention.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            classRoomId: true,
            classRoom: { select: { schoolId: true } },
          },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Intervensi tidak ditemukan" }, { status: 404 });
    }

    const actor = session.user;
    let allowed = actor.role === "SUPER_ADMIN";
    if (!allowed && actor.role === "PROVINCE_ADMIN") {
      const schoolId = existing.student.classRoom.schoolId;
      const scope = await getProvinceAdminScope(actor.id);
      allowed = Boolean(schoolId && scope?.schoolIds.includes(schoolId));
    }
    if (!allowed && actor.role === "SCHOOL_ADMIN") {
      allowed = Boolean(
        actor.schoolId && existing.student.classRoom.schoolId === actor.schoolId
      );
    }
    if (!allowed && actor.role === "TEACHER") {
      allowed = await canManagePjjClass(actor.id, existing.student.classRoomId);
    }
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const intervention = await prisma.pjjIntervention.update({
      where: { id },
      data: {
        category: input.category,
        note: input.note,
        followUpAt:
          input.followUpAt === undefined
            ? undefined
            : input.followUpAt
              ? new Date(input.followUpAt)
              : null,
        resolvedAt: input.resolve ? new Date() : undefined,
      },
      include: {
        student: { select: { id: true, name: true, nis: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, intervention });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Gagal memperbarui intervensi" }, { status: 500 });
  }
}
