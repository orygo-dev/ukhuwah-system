import {
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationTargetType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { schoolIdsForProvince } from "@/lib/province-scope";

export const NOTIFICATION_CATEGORIES: Array<{
  value: NotificationCategory;
  label: string;
}> = [
  { value: "GENERAL", label: "Pengumuman umum" },
  { value: "ACADEMIC", label: "Akademik" },
  { value: "ASSIGNMENT", label: "Tugas" },
  { value: "TKA", label: "TKA" },
  { value: "PJJ", label: "PJJ" },
  { value: "READING", label: "Zona Baca" },
  { value: "ADMINISTRATION", label: "Administrasi" },
  { value: "EVENT", label: "Agenda" },
];

export const NOTIFICATION_PRIORITIES: Array<{
  value: NotificationPriority;
  label: string;
}> = [
  { value: "NORMAL", label: "Normal" },
  { value: "IMPORTANT", label: "Penting" },
  { value: "URGENT", label: "Mendesak" },
];

export type NotificationActor = Awaited<ReturnType<typeof getNotificationActor>>;

export async function getNotificationActor(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      provinceId: true,
      province: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      classRooms: {
        where: { isActive: true },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, schoolId: true, school: { select: { id: true } } },
      },
    },
  });
}

export function canManageNotifications(role: UserRole) {
  return ["SUPER_ADMIN", "PROVINCE_ADMIN", "SCHOOL_ADMIN", "TEACHER"].includes(role);
}

export function notificationCenterHref(role: UserRole) {
  if (role === "SUPER_ADMIN") return "/admin/notifications";
  if (role === "PROVINCE_ADMIN") return "/province/notifications";
  if (role === "SCHOOL_ADMIN") return "/school/notifications";
  if (role === "STUDENT") return "/student/notifications";
  return "/dashboard/notifications";
}

function schoolMembershipWhere(schoolIds: string[]): Prisma.UserWhereInput {
  return {
    OR: [
      { schoolId: { in: schoolIds } },
      { teachingProfiles: { some: { schoolId: { in: schoolIds } } } },
      { classRooms: { some: { schoolId: { in: schoolIds } } } },
      {
        studentProfile: {
          is: { classRoom: { schoolId: { in: schoolIds } } },
        },
      },
    ],
  };
}

async function provinceScopedSchoolIds(actor: NonNullable<NotificationActor>) {
  if (!actor.provinceId) return [] as string[];
  return schoolIdsForProvince(actor.provinceId);
}

function allowedRole(actorRole: UserRole, targetRole: UserRole | null) {
  if (!targetRole) return false;
  if (actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "PROVINCE_ADMIN") {
    return ["SCHOOL_ADMIN", "TEACHER", "STUDENT"].includes(targetRole);
  }
  if (actorRole === "SCHOOL_ADMIN") {
    return ["TEACHER", "STUDENT"].includes(targetRole);
  }
  return false;
}

export async function notificationTargetOptions(actor: NonNullable<NotificationActor>) {
  if (actor.role === "SUPER_ADMIN" || actor.role === "PROVINCE_ADMIN") {
    const provinceSchoolIds =
      actor.role === "PROVINCE_ADMIN" ? await provinceScopedSchoolIds(actor) : null;
    const schools = await prisma.school.findMany({
      where: provinceSchoolIds ? { id: { in: provinceSchoolIds } } : undefined,
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, npsn: true, city: true },
    });
    return {
      targetTypes: ["ALL", "ROLE", "SCHOOL"] as NotificationTargetType[],
      roles:
        actor.role === "SUPER_ADMIN"
          ? (["PROVINCE_ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT"] as UserRole[])
          : (["SCHOOL_ADMIN", "TEACHER", "STUDENT"] as UserRole[]),
      schools,
      classes: [] as Array<{ id: string; name: string; schoolId: string | null }>,
    };
  }

  if (actor.role === "SCHOOL_ADMIN") {
    const classes = actor.school
      ? await prisma.classRoom.findMany({
          where: { schoolId: actor.school.id, isActive: true },
          orderBy: [{ name: "asc" }],
          select: { id: true, name: true, schoolId: true },
        })
      : [];
    return {
      targetTypes: ["ALL", "ROLE", "CLASS"] as NotificationTargetType[],
      roles: ["TEACHER", "STUDENT"] as UserRole[],
      schools: actor.school ? [{ ...actor.school, npsn: null, city: null }] : [],
      classes,
    };
  }

  return {
    targetTypes: ["CLASS"] as NotificationTargetType[],
    roles: ["STUDENT"] as UserRole[],
    schools: [] as Array<{ id: string; name: string; npsn: string | null; city: string | null }>,
    classes: actor.classRooms.map(({ school, ...room }) => ({
      ...room,
      schoolId: school?.id ?? null,
    })),
  };
}

type AudienceInput = {
  targetType: NotificationTargetType;
  targetRole?: UserRole | null;
  schoolId?: string | null;
  classRoomId?: string | null;
};

export async function resolveNotificationAudience(
  actor: NonNullable<NotificationActor>,
  input: AudienceInput
) {
  if (!canManageNotifications(actor.role)) throw new Error("FORBIDDEN");

  let where: Prisma.UserWhereInput = { id: { not: actor.id } };
  let targetLabel = "Semua pengguna";
  let schoolId: string | null = null;
  let classRoomId: string | null = null;
  let targetRole: UserRole | null = null;

  if (actor.role === "TEACHER") {
    if (input.targetType !== "CLASS" || !input.classRoomId) throw new Error("INVALID_TARGET");
    const room = actor.classRooms.find((item) => item.id === input.classRoomId);
    if (!room) throw new Error("FORBIDDEN_TARGET");
    classRoomId = room.id;
    schoolId = room.school?.id ?? null;
    targetRole = "STUDENT";
    targetLabel = `Siswa kelas ${room.name}`;
    where = {
      id: { not: actor.id },
      role: "STUDENT",
      studentProfile: { is: { classRoomId: room.id, isActive: true } },
    };
  } else if (input.targetType === "CLASS") {
    if (actor.role !== "SCHOOL_ADMIN" || !actor.school || !input.classRoomId) {
      throw new Error("FORBIDDEN_TARGET");
    }
    const room = await prisma.classRoom.findFirst({
      where: { id: input.classRoomId, schoolId: actor.school.id, isActive: true },
      select: { id: true, name: true, schoolId: true },
    });
    if (!room) throw new Error("FORBIDDEN_TARGET");
    classRoomId = room.id;
    schoolId = room.schoolId;
    targetRole = "STUDENT";
    targetLabel = `Siswa kelas ${room.name}`;
    where = {
      id: { not: actor.id },
      role: "STUDENT",
      studentProfile: { is: { classRoomId: room.id, isActive: true } },
    };
  } else {
    const permittedSchoolIds =
      actor.role === "SCHOOL_ADMIN"
        ? actor.school
          ? [actor.school.id]
          : []
        : actor.role === "PROVINCE_ADMIN"
          ? await provinceScopedSchoolIds(actor)
          : [];

    if (actor.role === "SCHOOL_ADMIN" && permittedSchoolIds.length === 0) {
      throw new Error("SCHOOL_REQUIRED");
    }
    if (actor.role === "PROVINCE_ADMIN" && !actor.provinceId) {
      throw new Error("PROVINCE_REQUIRED");
    }

    if (input.targetType === "SCHOOL") {
      if (!input.schoolId || !["SUPER_ADMIN", "PROVINCE_ADMIN"].includes(actor.role)) {
        throw new Error("FORBIDDEN_TARGET");
      }
      if (actor.role === "PROVINCE_ADMIN" && !permittedSchoolIds.includes(input.schoolId)) {
        throw new Error("FORBIDDEN_TARGET");
      }
      const school = await prisma.school.findUnique({
        where: { id: input.schoolId },
        select: { id: true, name: true },
      });
      if (!school) throw new Error("INVALID_TARGET");
      schoolId = school.id;
      targetLabel = `Seluruh warga ${school.name}`;
      where = {
        id: { not: actor.id },
        AND: [schoolMembershipWhere([school.id])],
      };
    } else if (input.targetType === "ROLE") {
      if (!allowedRole(actor.role, input.targetRole ?? null)) throw new Error("FORBIDDEN_TARGET");
      targetRole = input.targetRole ?? null;
      targetLabel = `Semua ${roleLabel(targetRole!)}`;
      where = {
        id: { not: actor.id },
        role: targetRole!,
        ...(actor.role === "SUPER_ADMIN"
          ? {}
          : { AND: [schoolMembershipWhere(permittedSchoolIds)] }),
      };
    } else if (input.targetType === "ALL") {
      if (actor.role === "SUPER_ADMIN") {
        where = { id: { not: actor.id } };
        targetLabel = "Semua pengguna platform";
      } else {
        where = {
          id: { not: actor.id },
          role: { in: actor.role === "PROVINCE_ADMIN" ? ["SCHOOL_ADMIN", "TEACHER", "STUDENT"] : ["TEACHER", "STUDENT"] },
          AND: [schoolMembershipWhere(permittedSchoolIds)],
        };
        targetLabel = actor.role === "PROVINCE_ADMIN" ? "Seluruh warga pendidikan" : `Seluruh warga ${actor.school?.name}`;
        schoolId = actor.role === "SCHOOL_ADMIN" ? actor.school?.id ?? null : null;
      }
    } else {
      throw new Error("INVALID_TARGET");
    }
  }

  const recipients = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return {
    recipientIds: recipients.map((recipient) => recipient.id),
    targetLabel,
    schoolId,
    classRoomId,
    targetRole,
  };
}

export function notificationVisibilityWhere(now = new Date()): Prisma.NotificationWhereInput {
  return {
    status: "PUBLISHED",
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export function roleLabel(role: UserRole) {
  const labels: Record<UserRole, string> = {
    SUPER_ADMIN: "Super Admin",
    PROVINCE_ADMIN: "Admin Dinas",
    SCHOOL_ADMIN: "Admin Sekolah",
    TEACHER: "Guru",
    STUDENT: "Siswa",
    MERCHANT: "Merchant",
  };
  return labels[role];
}

export function categoryLabel(category: NotificationCategory) {
  return NOTIFICATION_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function priorityLabel(priority: NotificationPriority) {
  return NOTIFICATION_PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

export function notificationStatusLabel(status: NotificationStatus, publishAt: Date) {
  if (status === "DRAFT") return "Draf";
  if (status === "ARCHIVED") return "Diarsipkan";
  if (publishAt > new Date()) return "Terjadwal";
  return "Terbit";
}
