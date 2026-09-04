import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** MySQL unique string columns in this schema are VARCHAR(191). */
const MAX_EMAIL_LENGTH = 190;

export function normalizeEmailDomain(raw: string) {
  let value = raw.trim().toLowerCase();
  if (value.includes("@")) {
    value = value.split("@").pop() || "";
  }
  return value.replace(/^@+/, "").replace(/\.+$/g, "");
}

export function isValidEmailDomain(domain: string) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain);
}

export function slugifyStudentPart(value: string, max = 40) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, max);
}

export function buildAutoStudentEmail(input: {
  name: string;
  nis?: string | null;
  studentId: string;
  emailDomain: string;
}) {
  const domain = normalizeEmailDomain(input.emailDomain);
  const idTail = input.studentId.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "siswa";
  const base =
    slugifyStudentPart(input.name, 24) || `siswa.${idTail.slice(0, 4)}`;
  const suffix = slugifyStudentPart(input.nis || idTail, 16) || idTail;
  let local = `${base}.${suffix}`;
  const maxLocal = Math.max(8, MAX_EMAIL_LENGTH - domain.length - 1);
  if (local.length > maxLocal) {
    local = `${local.slice(0, Math.max(4, maxLocal - 7))}.${idTail.slice(-4)}`;
    local = local.slice(0, maxLocal);
  }
  return `${local}@${domain}`.toLowerCase();
}

export function makeStudentTempPassword(seed: string) {
  const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, "").slice(-4) || "2026";
  return `Gs-${cleanSeed}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveUsableSchoolId(tx: Tx, schoolId: string | null | undefined) {
  const normalized = schoolId?.trim() || null;
  if (!normalized) return null;
  const school = await tx.school.findUnique({
    where: { id: normalized },
    select: { id: true },
  });
  return school?.id ?? null;
}

export async function createStudentLoginUser(
  tx: Tx,
  input: {
    email: string;
    password: string;
    name: string;
    schoolId: string | null;
    studentId: string;
  }
) {
  const email = input.email.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH) {
    throw new StudentAccountConflictError(
      "Email terlalu panjang. Gunakan domain yang lebih pendek."
    );
  }

  const existing = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new StudentAccountConflictError("Email sudah digunakan akun lain");
  }

  const student = await tx.student.findUnique({
    where: { id: input.studentId },
    select: { id: true, userId: true, isActive: true },
  });
  if (!student) {
    throw new StudentAccountConflictError("Data siswa tidak ditemukan.");
  }
  if (!student.isActive) {
    throw new StudentAccountConflictError(
      "Siswa tidak aktif. Aktifkan kembali siswa sebelum membuat akun login."
    );
  }
  if (student.userId) {
    throw new StudentAccountConflictError("Akun login siswa sudah aktif");
  }

  const schoolId = await resolveUsableSchoolId(tx, input.schoolId);
  const name = (input.name || "Siswa").trim().slice(0, 120) || "Siswa";

  const createdUser = await tx.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(input.password, 12),
      name,
      role: "STUDENT",
      schoolId,
      creditsRemaining: 0,
    },
    select: { id: true, email: true, name: true },
  });

  await tx.student.update({
    where: { id: input.studentId },
    data: { userId: createdUser.id },
  });

  return createdUser;
}

export async function revokeStudentLoginUser(
  tx: Tx,
  student: { id: string; userId: string | null }
) {
  const userId = student.userId;
  await tx.student.update({
    where: { id: student.id },
    data: {
      isActive: false,
      userId: null,
      parentAccessCodeHash: null,
      parentAccessCodeLookup: null,
      parentAccessEnabled: false,
    },
  });

  if (!userId) return;

  await tx.user.update({
    where: { id: userId },
    data: {
      // Free the original email so the same address can be reused later.
      email: `revoked.${userId}.${Date.now()}@guruspace.invalid`,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      authVersion: { increment: 1 },
    },
  });
}

export class StudentAccountConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudentAccountConflictError";
  }
}

export function prismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function isUniqueConstraintError(error: unknown) {
  return prismaErrorCode(error) === "P2002";
}

export function describeStudentAccountError(error: unknown) {
  const code = prismaErrorCode(error);
  if (code === "P2002") {
    return "Email sudah digunakan atau akun siswa sudah aktif.";
  }
  if (code === "P2000") {
    return "Email otomatis terlalu panjang. Gunakan domain yang lebih pendek.";
  }
  if (code === "P2003") {
    return "Data sekolah/kelas tidak valid untuk akun siswa.";
  }
  if (error instanceof StudentAccountConflictError) {
    return error.message;
  }
  if (error instanceof Error && /timed out|timeout/i.test(error.message)) {
    return "Aktivasi massal terlalu lama. Coba aktifkan lebih sedikit siswa sekaligus.";
  }
  return null;
}
