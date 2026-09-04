import { prisma } from "@/lib/prisma";
import { exportToDocx, exportToPdf } from "@/lib/export";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const access = await requireSchoolCommercialization();
    const format = new URL(request.url).searchParams.get("format") || "pdf";
    if (!['pdf', 'docx'].includes(format)) return Response.json({ error: "Format harus pdf atau docx." }, { status: 400 });
    if ((format === "pdf" && access.features.export_pdf !== true) || (format === "docx" && access.features.export_docx !== true)) return Response.json({ error: `Paket belum mencakup ekspor ${format.toUpperCase()}.` }, { status: 403 });
    const { id } = await params;
    const document = await prisma.schoolAdminDocument.findFirst({ where: { id, schoolId: access.schoolId, status: { in: ["APPROVED", "ARCHIVED"] } }, include: { school: { select: { name: true, npsn: true, address: true } } } });
    if (!document) return Response.json({ error: "Dokumen belum disetujui atau tidak ditemukan." }, { status: 404 });
    const letterhead = [`# ${document.school.name}`, document.school.npsn ? `NPSN: ${document.school.npsn}` : "", document.school.address || "", "---", document.documentNumber ? `Nomor: ${document.documentNumber}` : ""].filter(Boolean).join("\n\n");
    const brandedContent = `${letterhead}\n\n${document.content}`;
    const buffer = format === "docx" ? await exportToDocx(document.title, brandedContent) : await exportToPdf(document.title, brandedContent);
    const safeName = document.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().slice(0, 80) || "dokumen-sekolah";
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", "Content-Disposition": `attachment; filename="${safeName}.${format}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}
