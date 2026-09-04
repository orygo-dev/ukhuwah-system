import { NextResponse } from "next/server";
import { z } from "zod";
import { AttendanceStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionForUser } from "@/lib/attendance-access";
import { summarizeStatuses } from "@/lib/attendance";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  note: z.string().optional(),
  records: z
    .array(
      z.object({
        studentId: z.string(),
        status: z.nativeEnum(AttendanceStatus),
        note: z.string().optional(),
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
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke data absensi guru.");
  }

  const { id } = await params;
  const data = await getSessionForUser(id, session.user);
  if (!data) {
    return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  }

  const summary = summarizeStatuses(data.records.map((r) => r.status));

  return NextResponse.json({ session: data, summary });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menyimpan absensi.");
  }

  const { id } = await params;
  const existing = await getSessionForUser(id, session.user);
  if (!existing || existing.teacherId !== session.user.id) {
    return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
  }

  try {
    const body = patchSchema.parse(await req.json().catch(() => null));

    if (body.records?.length) {
      const allowedStudentIds = new Set(existing.records.map((record) => record.studentId));
      for (const record of body.records) {
        if (!allowedStudentIds.has(record.studentId)) {
          return NextResponse.json(
            { error: "Data siswa pada absensi tidak sesuai dengan sesi ini." },
            { status: 400 }
          );
        }
      }
    }

    if (body.note !== undefined) {
      await prisma.attendanceSession.update({
        where: { id },
        data: { note: body.note.trim() || null },
      });
    }

    if (body.records?.length) {
      await prisma.$transaction(
        body.records.map((r) =>
          prisma.attendanceRecord.updateMany({
            where: { sessionId: id, studentId: r.studentId },
            data: {
              status: r.status,
              note: r.note?.trim() || null,
            },
          })
        )
      );
    }

    const data = await getSessionForUser(id, session.user);
    const summary = summarizeStatuses(data!.records.map((r) => r.status));

    return NextResponse.json({ session: data, summary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan absensi" }, { status: 500 });
  }
}
