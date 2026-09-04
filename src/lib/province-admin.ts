import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schoolIdsForProvince } from "@/lib/province-scope";

export async function getCurrentProvinceAdmin(callbackUrl = "/province") {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }
  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin");
  }
  if (session.user.role === "SCHOOL_ADMIN") {
    redirect("/school");
  }
  if (session.user.role === "STUDENT") {
    redirect("/student");
  }
  if (session.user.role === "MERCHANT") {
    redirect("/merchant");
  }
  if (session.user.role !== "PROVINCE_ADMIN") {
    redirect("/dashboard");
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      provinceId: true,
      province: { select: { id: true, name: true } },
    },
  });

  if (!account || account.role !== "PROVINCE_ADMIN") {
    redirect("/api/auth/error?error=SessionExpired");
  }

  if (!account.provinceId || !account.province) {
    redirect(`/login?error=ProvinceNotBound&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const schoolIds = await schoolIdsForProvince(account.provinceId);

  return {
    session,
    account: {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      avatarUrl: account.avatarUrl,
      provinceId: account.provinceId,
      provinceName: account.province.name,
    },
    scope: {
      provinceId: account.provinceId,
      provinceName: account.province.name,
      schoolIds,
    },
  };
}
