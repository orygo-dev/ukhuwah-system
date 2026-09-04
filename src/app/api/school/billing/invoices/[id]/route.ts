import { prisma } from "@/lib/prisma";
import { exportToPdf } from "@/lib/export";
import { requireSchoolBillingAccount } from "@/lib/school-billing-auth";
import { schoolCommercializationErrorResponse } from "@/lib/school-commercialization-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [access, { id }] = await Promise.all([requireSchoolBillingAccount(), context.params]);
    const invoice = await prisma.schoolInvoice.findFirst({
      where: { id, schoolId: access.schoolId },
      include: {
        school: { select: { name: true, npsn: true, address: true } },
        paymentTransaction: { include: { plan: { select: { name: true } }, gateway: { select: { name: true } } } },
      },
    });
    if (!invoice) return Response.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    const payment = invoice.paymentTransaction;
    const content = [
      `# INVOICE ${invoice.number}`,
      `Sekolah: ${invoice.school.name}`,
      invoice.school.npsn ? `NPSN: ${invoice.school.npsn}` : "",
      invoice.school.address ? `Alamat: ${invoice.school.address}` : "",
      "---",
      payment ? `Paket: ${payment.plan.name}` : "Tagihan sekolah",
      payment ? `Periode: ${payment.billingCycle === "YEARLY" ? "Tahunan" : "Bulanan"}` : "",
      payment ? `Metode: ${payment.gateway.name}` : "",
      `Jumlah: Rp${Number(invoice.amount).toLocaleString("id-ID")}`,
      `Status: ${invoice.status}`,
      `Dibuat: ${invoice.createdAt.toLocaleDateString("id-ID")}`,
      invoice.dueAt ? `Jatuh tempo: ${invoice.dueAt.toLocaleDateString("id-ID")}` : "",
      invoice.paidAt ? `Dibayar: ${invoice.paidAt.toLocaleDateString("id-ID")}` : "",
      invoice.notes ? `Catatan: ${invoice.notes}` : "",
    ].filter(Boolean).join("\n\n");
    const buffer = await exportToPdf(invoice.number, content);
    return new Response(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}
