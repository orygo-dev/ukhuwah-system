import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SchoolAdminAccount = NonNullable<
  Awaited<ReturnType<typeof getCurrentSchoolAdmin>>["account"]
>;

export async function getCurrentSchoolAdmin(callbackUrl: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (session.user.role === "PROVINCE_ADMIN") {
    redirect("/province");
  }
  if (session.user.role === "STUDENT") {
    redirect("/student");
  }
  if (session.user.role === "MERCHANT") {
    redirect("/merchant");
  }
  if (session.user.role !== "SCHOOL_ADMIN") {
    redirect("/dashboard");
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      schoolId: true,
      school: {
        select: {
          id: true,
          name: true,
          npsn: true,
          level: true,
          city: true,
          province: true,
          logoUrl: true,
          regency: { select: { name: true, province: { select: { name: true } } } },
        },
      },
    },
  });

  return { session, account };
}

export function schoolRegion(
  school: {
    city?: string | null;
    province?: string | null;
    regency?: { name: string; province?: { name: string } | null } | null;
  } | null | undefined
) {
  return [
    school?.regency?.name || school?.city,
    school?.regency?.province?.name || school?.province,
  ]
    .filter(Boolean)
    .join(", ");
}

export function formatSchoolDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
