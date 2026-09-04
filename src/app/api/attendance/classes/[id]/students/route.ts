import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canManageClassRosterForUser,
  getClassRoomForUser,
} from "@/lib/attendance-access";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { forbiddenRoleResponse, isSchoolStaffRole } from "@/lib/api-role-guard";
import {
  createStudentLoginUser,
  describeStudentAccountError,
  isUniqueConstraintError,
  StudentAccountConflictError,
} from "@/lib/student-accounts";

type Params = { params: Promise<{ id: string }> };

const rosterSchema = z.object({
  nis: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1, "Nama siswa wajib diisi").max(120),
  gender: z.enum(["L", "P"]).optional(),
  parentPhone: z.string().trim().max(30).optional(),
});

const studentSchema = rosterSchema
  .extend({
    email: z.string().trim().email("Email siswa tidak valid").optional(),
    password: z.string().min(8, "Password minimal 8 karakter").optional(),
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.trim());
    const hasPassword = Boolean(data.password);
    if (hasEmail !== hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Email dan password harus diisi bersamaan untuk membuat akun login siswa",
      });
    }
  });

const bulkSchema = z.object({
  students: z.array(rosterSchema).min(1),
});

function studentIdentityKey(student: { nis?: string | null; name: string }) {
  const nis = student.nis?.trim();
  return nis ? `nis:${nis.toLowerCase()}` : `name:${student.name.trim().toLowerCase()}`;
}

function cleanStudent(student: z.infer<typeof rosterSchema>) {
  return {
    nis: student.nis?.trim() || null,
    name: student.name.trim(),
    gender: student.gender || null,
    parentPhone: student.parentPhone?.trim() || null,
  };
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak memiliki akses ke roster kelas guru.");
  }

  const { id } = await params;
  const room = await getClassRoomForUser(id, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(room, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa mengubah daftar siswa pada kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }

  const students = await prisma.student.findMany({
    where: { classRoomId: id, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ students });
}

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSchoolStaffRole(session.user.role)) {
    return forbiddenRoleResponse("Akun siswa tidak dapat mengubah roster kelas.");
  }

  const { id } = await params;
  const room = await getClassRoomForUser(id, session.user);
  if (!room) {
    return NextResponse.json({ error: "Kelas tidak ditemukan" }, { status: 404 });
  }
  if (!(await canManageClassRosterForUser(room, session.user))) {
    return NextResponse.json(
      { error: "Anda hanya bisa mengubah daftar siswa pada kelas yang Anda kelola atau kelas dalam sekolah Anda." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => null);

    if (body && typeof body === "object" && Array.isArray(body.students)) {
      const parsed = bulkSchema.parse(body);
      const cleanedStudents = parsed.students.map(cleanStudent);
      const uniqueStudents = cleanedStudents.filter((student, index, list) => {
        const key = studentIdentityKey(student);
        return list.findIndex((item) => studentIdentityKey(item) === key) === index;
      });
      const duplicateInFile = cleanedStudents.length - uniqueStudents.length;

      const existingStudents = await prisma.student.findMany({
        where: { classRoomId: id, isActive: true },
        select: { nis: true, name: true },
      });
      const existingKeys = new Set(existingStudents.map(studentIdentityKey));
      const toCreate = uniqueStudents.filter((student) => !existingKeys.has(studentIdentityKey(student)));
      const skippedExisting = uniqueStudents.length - toCreate.length;

      if (toCreate.length === 0) {
        return NextResponse.json(
          {
            error: "Semua siswa pada file sudah ada di kelas ini.",
            skipped: duplicateInFile + skippedExisting,
          },
          { status: 409 }
        );
      }

      if (session.user.role === "TEACHER") {
        const { entitlements } = await getUserPlanEntitlements(session.user.id);
        if (entitlements.maxStudents !== null) {
          const currentStudents = await prisma.student.count({
            where: {
              isActive: true,
              classRoom: { teacherId: session.user.id, isActive: true },
            },
          });
          if (currentStudents + toCreate.length > entitlements.maxStudents) {
            return NextResponse.json(
              {
                error: "Quota siswa pada paket langganan Anda sudah habis.",
                code: "STUDENT_LIMIT_REACHED",
              },
              { status: 429 }
            );
          }
        }
      }

      const students = await prisma.$transaction(
        toCreate.map((s) =>
          prisma.student.create({
            data: {
              classRoomId: id,
              ...s,
            },
          })
        )
      );
      return NextResponse.json({
        students,
        summary: {
          created: students.length,
          skipped: duplicateInFile + skippedExisting,
        },
      });
    }

    const parsed = studentSchema.parse(body);
    const cleaned = cleanStudent(parsed);
    const existing = await prisma.student.findFirst({
      where: {
        classRoomId: id,
        isActive: true,
        OR: [
          ...(cleaned.nis ? [{ nis: cleaned.nis }] : []),
          { name: { equals: cleaned.name } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Siswa dengan NIS atau nama yang sama sudah ada di kelas ini." },
        { status: 409 }
      );
    }

    if (session.user.role === "TEACHER") {
      const { entitlements } = await getUserPlanEntitlements(session.user.id);
      if (entitlements.maxStudents !== null) {
        const currentStudents = await prisma.student.count({
          where: {
            isActive: true,
            classRoom: { teacherId: session.user.id, isActive: true },
          },
        });
        if (currentStudents >= entitlements.maxStudents) {
          return NextResponse.json(
            {
              error: "Quota siswa pada paket langganan Anda sudah habis.",
              code: "STUDENT_LIMIT_REACHED",
            },
            { status: 429 }
          );
        }
      }
    }

    const withAccount = Boolean(parsed.email && parsed.password);
    try {
      const result = await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            classRoomId: id,
            ...cleaned,
          },
        });

        if (!withAccount) {
          return { student, user: null };
        }

        const user = await createStudentLoginUser(tx, {
          email: parsed.email!,
          password: parsed.password!,
          name: cleaned.name,
          schoolId: room.schoolId,
          studentId: student.id,
        });

        return {
          student: { ...student, userId: user.id },
          user,
        };
      });

      return NextResponse.json({
        student: result.student,
        user: result.user,
        accountCreated: Boolean(result.user),
      });
    } catch (accountError) {
      if (accountError instanceof StudentAccountConflictError) {
        return NextResponse.json({ error: accountError.message }, { status: 409 });
      }
      if (isUniqueConstraintError(accountError)) {
        return NextResponse.json(
          { error: "Email sudah digunakan atau akun siswa sudah aktif" },
          { status: 409 }
        );
      }
      const described = describeStudentAccountError(accountError);
      if (described) {
        return NextResponse.json({ error: described }, { status: 400 });
      }
      throw accountError;
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors[0]?.message || "Data tidak valid" },
        { status: 400 }
      );
    }
    const described = describeStudentAccountError(err);
    console.error("[class students POST]", err);
    return NextResponse.json(
      { error: described || "Gagal menambah siswa" },
      { status: described ? 400 : 500 }
    );
  }
}
