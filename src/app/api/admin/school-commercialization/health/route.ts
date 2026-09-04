import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return Response.json({ error: "Forbidden" }, { status: 403 });
  const [subscriptions, negativeLedgers, pjjOverCap, stalePendingPayments, orphanPaidPayments, paidInvoiceMismatches] = await Promise.all([
    prisma.schoolSubscription.findMany({ include: { plan: true, _count: { select: { seats: { where: { releasedAt: null } } } } } }),
    prisma.schoolCreditLedger.count({ where: { balanceAfter: { lt: 0 } } }),
    prisma.schoolPjjUsage.count({ where: { peakParticipants: { gt: 25 } } }),
    prisma.schoolPaymentTransaction.count({ where: { status: "PENDING", expiresAt: { lt: new Date() } } }),
    prisma.schoolPaymentTransaction.count({ where: { status: "PAID", subscriptionId: null } }),
    prisma.schoolPaymentTransaction.count({ where: { status: "PAID", invoice: { status: { not: "PAID" } } } }),
  ]);
  const activeBySchool = new Map<string, number>();
  for (const item of subscriptions) if (item.status !== "CANCELED") activeBySchool.set(item.schoolId, (activeBySchool.get(item.schoolId) || 0) + 1);
  const observations = {
    negativeLedgers,
    pjjOverCap,
    duplicateCurrentSubscriptions: [...activeBySchool.values()].filter((count) => count > 1).length,
    seatOverages: subscriptions.filter((item) => item._count.seats > item.plan.maxTeacherSeats).length,
    stalePendingPayments,
    orphanPaidPayments,
    paidInvoiceMismatches,
  };
  return Response.json({ status: Object.values(observations).every((value) => value === 0) ? "PASS" : "FAIL", observations, checkedAt: new Date().toISOString() });
}
