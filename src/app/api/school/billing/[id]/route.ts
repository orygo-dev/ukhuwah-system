import { prisma } from "@/lib/prisma";
import { requireSchoolBillingAccount } from "@/lib/school-billing-auth";
import { schoolCommercializationErrorResponse } from "@/lib/school-commercialization-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [access, { id }] = await Promise.all([requireSchoolBillingAccount(), context.params]);
    const transaction = await prisma.schoolPaymentTransaction.findFirst({
      where: { id, schoolId: access.schoolId },
      include: { plan: { select: { name: true } }, invoice: { select: { number: true, status: true } } },
    });
    if (!transaction) return Response.json({ error: "Transaksi sekolah tidak ditemukan." }, { status: 404 });
    return Response.json({ transaction });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}
