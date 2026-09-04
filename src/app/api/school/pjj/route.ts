import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeJenjang } from "@/lib/curriculum";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createClass"),
    programId: z.string().cuid(),
    name: z.string().trim().min(2).max(120),
    jenjang: z.string().trim().min(1).max(60),
    schoolYear: z.string().trim().min(4).max(20),
    coordinatorId: z.string().cuid(),
  }),
  z.object({
    action: z.literal("assignTeacher"),
    classRoomId: z.string().cuid(),
    teacherId: z.string().cuid(),
    subject: z.string().trim().min(2).max(100),
    role: z.enum(["COORDINATOR", "SUBJECT_TEACHER", "TUTOR", "COUNSELOR", "SUBSTITUTE"]),
  }),
  z.object({
    action: z.literal("enrollRoster"),
    classRoomId: z.string().cuid(),
  }),
  z.object({
    action: z.literal("updateEnrollment"),
    enrollmentId: z.string().cuid(),
    status: z
      .enum(["PENDING", "ACTIVE", "AT_RISK", "WITHDRAWN", "COMPLETED"])
      .optional(),
    accessBarrier: z.string().trim().max(2000).nullable().optional(),
    learningCenterName: z.string().trim().max(200).nullable().optional(),
  }),
]);

async function getSchoolSession() {
  const session = await auth();
  if (session?.user.role !== "SCHOOL_ADMIN") return null;
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { schoolId: true },
  });
  if (!account?.schoolId) return null;
  return { ...session, user: { ...session.user, schoolId: account.schoolId } };
}
export async function GET() {
  const session = await getSchoolSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.user.schoolId!;
  const [programLinks, classes, teachers] = await Promise.all([
    prisma.pjjProgramSchool.findMany({
      where: { schoolId, isApproved: true },
      orderBy: { createdAt: "desc" },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            province: true,
            schoolYear: true,
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    }),
    prisma.classRoom.findMany({
      where: { schoolId, deliveryMode: { in: ["PJJ", "HYBRID"] } },
      orderBy: [{ tahunAjaran: "desc" }, { name: "asc" }],
      include: {
        pjjProgram: { select: { id: true, name: true, status: true } },
        teacher: { select: { id: true, name: true } },
        teacherAssignments: {
          where: { isActive: true },
          include: { teacher: { select: { id: true, name: true, email: true } } },
          orderBy: [{ role: "asc" }, { subject: "asc" }],
        },
        students: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            nis: true,
            userId: true,
            pjjEnrollments: {
              select: {
                id: true,
                status: true,
                programId: true,
                accessBarrier: true,
                learningCenterName: true,
                joinedAt: true,
              },
            },
          },
        },
        liveClassSessions: {
          orderBy: { scheduledStart: "desc" },
          take: 10,
          include: { _count: { select: { participants: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  return NextResponse.json({ programLinks, classes, teachers });
}

export async function POST(request: Request) {
  const session = await getSchoolSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const schoolId = session.user.schoolId!;
  try {
    const input = actionSchema.parse(await request.json());
    if (input.action === "createClass") {
      const [link, coordinator, duplicate] = await Promise.all([
        prisma.pjjProgramSchool.findFirst({
          where: {
            schoolId,
            programId: input.programId,
            role: "INDUK",
            isApproved: true,
            program: { status: { in: ["DRAFT", "ACTIVE"] } },
          },
          select: { programId: true, role: true },
        }),
        prisma.user.findFirst({
          where: { id: input.coordinatorId, schoolId, role: "TEACHER" },
          select: { id: true },
        }),
        prisma.classRoom.findFirst({
          where: {
            teacherId: input.coordinatorId,
            name: input.name,
            tahunAjaran: input.schoolYear,
          },
          select: { id: true },
        }),
      ]);
      if (!link) {
        const anyLink = await prisma.pjjProgramSchool.findFirst({
          where: { schoolId, programId: input.programId, isApproved: true },
          select: { role: true },
        });
        if (anyLink?.role === "MITRA") {
          return NextResponse.json(
            {
              error:
                "Sekolah Anda terdaftar sebagai Mitra pada program ini. Hanya sekolah Induk yang dapat membuat kelas PJJ. Hubungi Dinas untuk mengubah peran menjadi Induk.",
            },
            { status: 403 }
          );
        }
        return NextResponse.json(
          {
            error:
              "Sekolah belum terhubung sebagai Induk pada program PJJ ini, atau program belum DRAFT/ACTIVE. Minta Dinas menambahkan sekolah Anda sebagai Induk.",
          },
          { status: 403 }
        );
      }
      if (!coordinator) {
        return NextResponse.json(
          {
            error:
              "Guru koordinator tidak ditemukan di sekolah ini. Pastikan guru sudah ditambahkan di menu Guru dan terhubung ke sekolah Anda.",
          },
          { status: 404 }
        );
      }
      if (duplicate) {
        return NextResponse.json(
          {
            error: `Nama kelas "${input.name}" sudah dipakai koordinator ini pada tahun ajaran ${input.schoolYear}. Ganti nama kelas atau tahun ajaran.`,
          },
          { status: 400 }
        );
      }
      const normalizedJenjang = normalizeJenjang(input.jenjang);
      if (!normalizedJenjang) {
        return NextResponse.json({ error: "Tingkat kelas tidak dikenali. Gunakan format SD, SMP, SMA, SMK, atau Kelas X–XII." }, { status: 400 });
      }
      const classRoom = await prisma.$transaction(async (tx) => {
        const created = await tx.classRoom.create({
          data: {
            teacherId: coordinator.id,
            schoolId,
            name: input.name,
            jenjang: normalizedJenjang,
            tahunAjaran: input.schoolYear,
            deliveryMode: "PJJ",
            pjjProgramId: input.programId,
          },
        });
        await tx.classTeacherAssignment.create({
          data: {
            classRoomId: created.id,
            teacherId: coordinator.id,
            subject: "Koordinasi PJJ",
            role: "COORDINATOR",
          },
        });
        return created;
      });
      return NextResponse.json({
        success: true,
        classRoom,
        nextStep:
          "Kelas berhasil dibuat. Lanjutkan: tambah siswa di Kelola roster, lalu kembali ke halaman ini dan klik Aktifkan roster PJJ.",
      });
    }

    if (input.action === "updateEnrollment") {
      const enrollment = await prisma.pjjEnrollment.findUnique({
        where: { id: input.enrollmentId },
        select: {
          id: true,
          status: true,
          joinedAt: true,
          student: {
            select: {
              classRoom: { select: { schoolId: true } },
            },
          },
        },
      });
      if (!enrollment || enrollment.student.classRoom.schoolId !== schoolId) {
        return NextResponse.json(
          { error: "Pendaftaran tidak ditemukan atau di luar sekolah Anda." },
          { status: 404 }
        );
      }

      const nextStatus = input.status ?? enrollment.status;
      const data: {
        status?: typeof nextStatus;
        accessBarrier?: string | null;
        learningCenterName?: string | null;
        joinedAt?: Date;
        completedAt?: Date | null;
      } = {};

      if (input.status !== undefined) data.status = input.status;
      if (input.accessBarrier !== undefined) data.accessBarrier = input.accessBarrier;
      if (input.learningCenterName !== undefined) {
        data.learningCenterName = input.learningCenterName;
      }

      if (
        ["ACTIVE", "AT_RISK"].includes(nextStatus) &&
        !enrollment.joinedAt
      ) {
        data.joinedAt = new Date();
      }
      if (nextStatus === "COMPLETED") {
        data.completedAt = new Date();
      } else if (input.status !== undefined) {
        data.completedAt = null;
      }

      const updated = await prisma.pjjEnrollment.update({
        where: { id: enrollment.id },
        data,
      });
      return NextResponse.json({ success: true, enrollment: updated });
    }

    const classRoom = await prisma.classRoom.findFirst({
      where: { id: input.classRoomId, schoolId, deliveryMode: { in: ["PJJ", "HYBRID"] } },
      select: { id: true, pjjProgramId: true },
    });
    if (!classRoom?.pjjProgramId) return NextResponse.json({ error: "Kelas PJJ tidak ditemukan." }, { status: 404 });

    if (input.action === "assignTeacher") {
      const teacher = await prisma.user.findFirst({
        where: { id: input.teacherId, schoolId, role: "TEACHER" },
        select: { id: true },
      });
      if (!teacher) return NextResponse.json({ error: "Guru tidak ditemukan di sekolah ini." }, { status: 404 });
      await prisma.classTeacherAssignment.upsert({
        where: {
          classRoomId_teacherId_subject_role: {
            classRoomId: classRoom.id,
            teacherId: teacher.id,
            subject: input.subject,
            role: input.role,
          },
        },
        create: {
          classRoomId: classRoom.id,
          teacherId: teacher.id,
          subject: input.subject,
          role: input.role,
        },
        update: { isActive: true },
      });
      return NextResponse.json({ success: true });
    }

    const students = await prisma.student.findMany({
      where: { classRoomId: classRoom.id, isActive: true },
      select: { id: true },
    });
    await prisma.$transaction(
      students.map((student) =>
        prisma.pjjEnrollment.upsert({
          where: {
            programId_studentId: { programId: classRoom.pjjProgramId!, studentId: student.id },
          },
          create: {
            programId: classRoom.pjjProgramId!,
            studentId: student.id,
            status: "ACTIVE",
            joinedAt: new Date(),
          },
          update: { status: "ACTIVE" },
        })
      )
    );
    return NextResponse.json({ success: true, enrolled: students.length });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.errors[0]?.message || "Data PJJ tidak valid."
        : error instanceof Error && "code" in error && error.code === "P2002"
          ? "Nama kelas PJJ sudah dipakai koordinator yang sama pada tahun ajaran tersebut. Ganti nama kelas atau tahun ajaran."
          : error instanceof Error
            ? error.message
            : "Operasi kelas PJJ gagal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
