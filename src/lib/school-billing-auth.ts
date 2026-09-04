import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSchoolCommercializationEnabled } from "@/lib/school-commercialization";
import { SchoolCommercializationError } from "@/lib/school-commercialization-auth";

export async function requireSchoolBillingAccount() {
  if (!isSchoolCommercializationEnabled()) {
    throw new SchoolCommercializationError("FEATURE_DISABLED", 404, "Fitur paket sekolah belum diaktifkan.");
  }
  const session = await auth();
  if (!session?.user) throw new SchoolCommercializationError("UNAUTHORIZED", 401, "Unauthorized");
  if (session.user.role !== "SCHOOL_ADMIN") {
    throw new SchoolCommercializationError("FORBIDDEN", 403, "Hanya admin sekolah yang dapat mengelola pembayaran sekolah.");
  }
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, schoolId: true, school: { select: { id: true, name: true } } },
  });
  if (!account?.schoolId || !account.school) {
    throw new SchoolCommercializationError("SCHOOL_REQUIRED", 409, "Akun belum terhubung ke sekolah.");
  }
  return { session, account, schoolId: account.schoolId, userId: account.id };
}
