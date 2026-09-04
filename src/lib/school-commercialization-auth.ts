import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCurrentSchoolSubscription,
  isSchoolCommercializationEnabled,
  isSchoolSubscriptionReadable,
  isSchoolSubscriptionWritable,
  mergeSchoolFeatures,
} from "@/lib/school-commercialization";

export class SchoolCommercializationError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export async function requireSchoolCommercialization(options?: { write?: boolean }) {
  if (!isSchoolCommercializationEnabled()) {
    throw new SchoolCommercializationError("FEATURE_DISABLED", 404, "Fitur paket sekolah belum diaktifkan.");
  }
  const session = await auth();
  if (!session?.user) throw new SchoolCommercializationError("UNAUTHORIZED", 401, "Unauthorized");
  if (session.user.role !== "SCHOOL_ADMIN") {
    throw new SchoolCommercializationError("FORBIDDEN", 403, "Hanya admin sekolah yang dapat mengakses fitur ini.");
  }
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, schoolId: true },
  });
  if (!account?.schoolId) {
    throw new SchoolCommercializationError("SCHOOL_REQUIRED", 409, "Akun belum terhubung ke sekolah.");
  }
  const subscription = await getCurrentSchoolSubscription(account.schoolId);
  if (!subscription || !isSchoolSubscriptionReadable(subscription.status)) {
    throw new SchoolCommercializationError("SUBSCRIPTION_REQUIRED", 402, "Sekolah belum memiliki paket aktif.");
  }
  if (options?.write && !isSchoolSubscriptionWritable(subscription.status, new Date(), subscription)) {
    throw new SchoolCommercializationError(
      "SUBSCRIPTION_READ_ONLY",
      403,
      "Paket sekolah sedang read-only. Data lama tetap tersedia, tetapi perubahan baru dinonaktifkan."
    );
  }
  return {
    session,
    userId: account.id,
    schoolId: account.schoolId,
    subscription,
    features: mergeSchoolFeatures(subscription.plan.features, subscription.featureOverrides),
  };
}

export function schoolCommercializationErrorResponse(error: unknown) {
  if (error instanceof SchoolCommercializationError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[school commercialization]", error);
  return Response.json({ error: "Permintaan paket sekolah gagal." }, { status: 500 });
}
