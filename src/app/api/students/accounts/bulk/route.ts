import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAutoStudentEmail,
  describeStudentAccountError,
  isUniqueConstraintError,
  isValidEmailDomain,
  makeStudentTempPassword,
  normalizeEmailDomain,
} from "@/lib/student-accounts";

const bulkAccountSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(50),
  emailDomain: z
    .string()
    .trim()
    .min(3, "Domain email wajib diisi")
    .max(120)
    .transform(normalizeEmailDomain)
    .refine(isValidEmailDomain, "Domain email tidak valid"),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Role akun tidak dapat mengaktifkan akun siswa secara massal." },
        { status: 403 }
      );
    }

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, schoolId: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
    }
    if (account.role === "SCHOOL_ADMIN" && !account.schoolId) {
      return NextResponse.json(
        { error: "Akun admin sekolah belum terhubung ke sekolah." },
        { status: 400 }
      );
    }

    const parsed = bulkAccountSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Data aktivasi tidak valid" },
        { status: 400 }
      );
    }

    const uniqueIds = Array.from(new Set(parsed.data.studentIds));
    const emailDomain = parsed.data.emailDomain;
    const students = await prisma.student.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        userId: null,
        classRoom: {
          isActive: true,
          ...(account.role === "TEACHER"
            ? {
                OR: [
                  { teacherId: account.id },
                  {
                    teacherAssignments: {
                      some: { teacherId: account.id, isActive: true },
                    },
                  },
                ],
              }
            : account.role === "SCHOOL_ADMIN"
              ? { schoolId: account.schoolId! }
              : {}),
        },
      },
      include: {
        classRoom: { select: { name: true, schoolId: true } },
      },
      orderBy: { name: "asc" },
    });

    const eligibleIds = new Set(students.map((student) => student.id));
    const skipped: { studentId: string; name: string; reason: string }[] = [];
    for (const studentId of uniqueIds) {
      if (!eligibleIds.has(studentId)) {
        skipped.push({
          studentId,
          name: studentId,
          reason:
            "Siswa tidak valid, sudah punya akun, tidak aktif, atau di luar kelas yang Anda kelola",
        });
      }
    }

    if (students.length === 0) {
      return NextResponse.json(
        {
          error:
            "Tidak ada siswa valid yang belum memiliki akun login. Pastikan Anda guru pengelola kelas tersebut.",
          skipped,
        },
        { status: 400 }
      );
    }

    const schoolByStudentId = new Map(
      students.map((student) => [student.id, student.classRoom.schoolId])
    );

    const candidateEmails = students.map((student) =>
      buildAutoStudentEmail({
        name: student.name,
        nis: student.nis,
        studentId: student.id,
        emailDomain,
      })
    );

    const existingEmails = await prisma.user.findMany({
      where: { email: { in: candidateEmails } },
      select: { email: true },
    });
    const usedEmails = new Set(existingEmails.map((user) => user.email));

    const credentials: {
      studentId: string;
      name: string;
      className: string;
      email: string;
      password: string;
    }[] = [];

    for (const student of students) {
      const email = buildAutoStudentEmail({
        name: student.name,
        nis: student.nis,
        studentId: student.id,
        emailDomain,
      });
      if (usedEmails.has(email)) {
        skipped.push({
          studentId: student.id,
          name: student.name,
          reason: `Email otomatis sudah digunakan (${email})`,
        });
        continue;
      }
      usedEmails.add(email);
      credentials.push({
        studentId: student.id,
        name: student.name,
        className: student.classRoom.name,
        email,
        password: makeStudentTempPassword(student.nis || student.id),
      });
    }

    if (credentials.length === 0) {
      return NextResponse.json(
        { error: "Semua email otomatis sudah digunakan.", skipped },
        { status: 409 }
      );
    }

    const hashed = await Promise.all(
      credentials.map(async (item) => ({
        ...item,
        passwordHash: await bcrypt.hash(item.password, 12),
      }))
    );

    await prisma.$transaction(
      async (tx) => {
        for (const item of hashed) {
          const user = await tx.user.create({
            data: {
              email: item.email,
              passwordHash: item.passwordHash,
              name: item.name,
              role: "STUDENT",
              schoolId: schoolByStudentId.get(item.studentId) ?? null,
              creditsRemaining: 0,
            },
            select: { id: true },
          });

          await tx.student.update({
            where: { id: item.studentId },
            data: { userId: user.id },
            select: { id: true },
          });
        }
      },
      { timeout: 60_000, maxWait: 15_000 }
    );

    return NextResponse.json({
      success: true,
      created: credentials,
      skipped,
    });
  } catch (error) {
    const described = describeStudentAccountError(error);
    if (described) {
      return NextResponse.json(
        { error: described },
        { status: isUniqueConstraintError(error) ? 409 : 400 }
      );
    }
    console.error("[student accounts bulk POST]", error);
    return NextResponse.json(
      {
        error:
          "Gagal mengaktifkan akun siswa secara massal. Coba domain lebih pendek atau aktifkan per siswa.",
      },
      { status: 500 }
    );
  }
}
