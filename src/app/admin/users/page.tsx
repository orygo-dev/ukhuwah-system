import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/layout/admin-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  try {
    const [users, schools, provinces, totalUsers, roleGroups, creditSummary] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          schoolId: true,
          provinceId: true,
          creditsRemaining: true,
          walletBalance: true,
          createdAt: true,
          planExpiresAt: true,
          plan: { select: { name: true, slug: true } },
          school: { select: { name: true } },
          province: { select: { name: true } },
          _count: { select: { documents: true, transactions: true } },
        },
      }),
      prisma.school.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          npsn: true,
          city: true,
          province: true,
          regency: { select: { name: true, province: { select: { name: true } } } },
        },
      }),
      prisma.province.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        _count: { _all: true },
      }),
      prisma.user.aggregate({
        _sum: { creditsRemaining: true, walletBalance: true },
      }),
    ]);

    const roleCounts = Object.fromEntries(
      roleGroups.map((row) => [row.role, row._count._all])
    );

    return (
      <AdminShell activePath="/admin/users">
        <AdminUsersClient
          users={users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
            schoolName: user.school?.name ?? null,
            provinceId: user.provinceId,
            provinceName: user.province?.name ?? null,
            planName: user.plan?.name ?? "Free",
            planSlug: user.plan?.slug ?? null,
            planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
            creditsRemaining: user.creditsRemaining,
            walletBalance: Number(user.walletBalance || 0),
            documentsCount: user._count.documents,
            transactionsCount: user._count.transactions,
            createdAt: user.createdAt.toISOString(),
          }))}
          totalUsers={totalUsers}
          schools={schools.map((school) => ({
            id: school.id,
            name: school.name,
            npsn: school.npsn,
            city: school.regency?.name ?? school.city,
            provinceName: school.regency?.province?.name ?? school.province,
          }))}
          provinces={provinces}
          roleCounts={roleCounts}
          totalCredits={creditSummary._sum.creditsRemaining || 0}
          totalWalletBalance={Number(creditSummary._sum.walletBalance || 0)}
        />
      </AdminShell>
    );
  } catch (error) {
    console.error("[admin users]", error);
    return (
      <AdminShell activePath="/admin/users">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-8">
            <h1 className="text-xl font-bold text-destructive">Gagal memuat pengguna</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Terjadi masalah saat mengambil data pengguna. Coba muat ulang halaman.
            </p>
          </CardContent>
        </Card>
      </AdminShell>
    );
  }
}
