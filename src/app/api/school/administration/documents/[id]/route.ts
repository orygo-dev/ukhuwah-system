import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

type Params = { params: Promise<{ id: string }> };
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), expectedVersion: z.number().int().positive(), title: z.string().trim().min(3).max(200), content: z.string().trim().min(1).max(200000) }),
  z.object({ action: z.literal("submit"), expectedVersion: z.number().int().positive() }),
  z.object({ action: z.literal("return-draft"), expectedVersion: z.number().int().positive() }),
  z.object({ action: z.literal("verify"), expectedVersion: z.number().int().positive() }),
  z.object({ action: z.literal("approve"), expectedVersion: z.number().int().positive(), documentNumber: z.string().trim().max(100).optional() }),
  z.object({ action: z.literal("archive"), expectedVersion: z.number().int().positive() }),
]);

export async function GET(_: Request, { params }: Params) {
  try {
    const access = await requireSchoolCommercialization();
    const { id } = await params;
    const document = await prisma.schoolAdminDocument.findFirst({ where: { id, schoolId: access.schoolId }, include: { versions: { orderBy: { version: "desc" } }, createdBy: { select: { name: true } }, verifiedBy: { select: { name: true } }, approvedBy: { select: { name: true } } } });
    return document ? Response.json({ document }) : Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    const { id } = await params;
    const input = schema.parse(await request.json());
    const current = await prisma.schoolAdminDocument.findFirst({ where: { id, schoolId: access.schoolId } });
    if (!current) return Response.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

    const allowed =
      (input.action === "edit" && current.status === "DRAFT") ||
      (input.action === "submit" && current.status === "DRAFT") ||
      (input.action === "return-draft" && ["IN_REVIEW", "VERIFIED"].includes(current.status)) ||
      (input.action === "verify" && current.status === "IN_REVIEW") ||
      (input.action === "approve" && current.status === "VERIFIED") ||
      (input.action === "archive" && current.status === "APPROVED");
    if (!allowed) return Response.json({ error: `Transisi ${current.status} → ${input.action} tidak diizinkan.` }, { status: 409 });

    const nextVersion = current.version + 1;
    const data = input.action === "edit"
      ? { title: input.title, content: input.content, version: nextVersion }
      : input.action === "submit"
        ? { status: "IN_REVIEW" as const, version: nextVersion }
        : input.action === "return-draft"
          ? { status: "DRAFT" as const, verifiedById: null, verifiedAt: null, version: nextVersion }
          : input.action === "verify"
            ? { status: "VERIFIED" as const, verifiedById: access.userId, verifiedAt: new Date(), version: nextVersion }
            : input.action === "approve"
              ? { status: "APPROVED" as const, approvedById: access.userId, approvedAt: new Date(), documentNumber: input.documentNumber || `${current.kind}/${new Date().getFullYear()}/${current.id.slice(-8).toUpperCase()}`, version: nextVersion }
              : { status: "ARCHIVED" as const, archivedAt: new Date(), version: nextVersion };

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.schoolAdminDocument.updateMany({ where: { id, schoolId: access.schoolId, version: input.expectedVersion }, data });
      if (changed.count !== 1) throw new Error("DOCUMENT_VERSION_CONFLICT");
      const result = await tx.schoolAdminDocument.findUniqueOrThrow({ where: { id } });
      await tx.schoolDocumentVersion.create({ data: { documentId: id, version: nextVersion, content: result.content, createdById: access.userId } });
      return result;
    });
    return Response.json({ document: updated });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && error.message === "DOCUMENT_VERSION_CONFLICT") return Response.json({ error: "Dokumen telah berubah di tab/perangkat lain. Muat ulang sebelum melanjutkan.", code: error.message }, { status: 409 });
    return schoolCommercializationErrorResponse(error);
  }
}
