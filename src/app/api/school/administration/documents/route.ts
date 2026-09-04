import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/lib/ai/generate";
import { spendSchoolCredits } from "@/lib/school-credit-ledger";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

const kinds = ["LETTER", "DECREE", "WORK_PROGRAM", "MEETING_MINUTES", "REPORT", "SUPERVISION", "OTHER"] as const;
const schema = z.object({
  mode: z.enum(["manual", "ai"]).default("manual"),
  kind: z.enum(kinds),
  title: z.string().trim().min(3).max(200),
  content: z.string().max(200000).optional(),
  templateId: z.string().cuid().optional(),
  inputData: z.record(z.unknown()).default({}),
});

export async function GET(request: Request) {
  try {
    const access = await requireSchoolCommercialization();
    const kind = new URL(request.url).searchParams.get("kind");
    const documents = await prisma.schoolAdminDocument.findMany({
      where: { schoolId: access.schoolId, ...(kinds.includes(kind as (typeof kinds)[number]) ? { kind: kind as (typeof kinds)[number] } : {}) },
      include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return Response.json({ documents });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    if (access.features.administration !== true) return Response.json({ error: "Paket belum mencakup administrasi sekolah." }, { status: 403 });
    const input = schema.parse(await request.json());
    let content = input.content?.trim() || "";
    if (input.templateId) {
      const template = await prisma.schoolDocumentTemplate.findFirst({ where: { id: input.templateId, schoolId: access.schoolId, isActive: true } });
      if (!template) return Response.json({ error: "Template tidak ditemukan di sekolah ini." }, { status: 404 });
      if (!content) content = template.contentTemplate;
    }
    let aiMeta: Record<string, unknown> = {};
    if (input.mode === "ai") {
      if (access.features.ai_drafts !== true) return Response.json({ error: "Paket belum mencakup draft AI." }, { status: 403 });
      if (access.subscription.creditBalance < 1) return Response.json({ error: "Kredit AI sekolah tidak cukup.", code: "INSUFFICIENT_SCHOOL_CREDITS" }, { status: 402 });
      const school = await prisma.school.findUnique({ where: { id: access.schoolId }, select: { name: true, npsn: true, address: true } });
      const metrics = input.kind === "REPORT" ? await Promise.all([
        prisma.user.count({ where: { schoolId: access.schoolId, role: "TEACHER" } }),
        prisma.classRoom.count({ where: { schoolId: access.schoolId, isActive: true } }),
        prisma.student.count({ where: { classRoom: { schoolId: access.schoolId }, isActive: true } }),
      ]) : null;
      const generated = await generateDocument({
        toolSlug: "surat-dinas",
        userId: access.userId,
        data: {
          sekolah: school?.name,
          npsn: school?.npsn,
          alamatSekolah: school?.address,
          jenisDokumen: input.kind,
          judul: input.title,
          ...input.inputData,
          ...(metrics ? { dataAktual: { jumlahGuru: metrics[0], jumlahKelas: metrics[1], jumlahSiswa: metrics[2] } } : {}),
          instruksi: "Hasil wajib berupa DRAFT yang perlu diverifikasi admin. Jangan mengarang data faktual yang tidak diberikan.",
        },
      });
      content = generated.content;
      aiMeta = { providerUsed: generated.providerUsed, isDemo: generated.isDemo, usageRequestId: generated.usageRequestId };
    }
    if (!content) return Response.json({ error: "Isi dokumen wajib diisi." }, { status: 400 });

    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.schoolAdminDocument.create({ data: { schoolId: access.schoolId, kind: input.kind, title: input.title, content, inputData: { ...input.inputData, ...aiMeta } as Prisma.InputJsonValue, createdById: access.userId } });
      await tx.schoolDocumentVersion.create({ data: { documentId: created.id, version: 1, content, createdById: access.userId } });
      if (input.mode === "ai") {
        await spendSchoolCredits({ schoolId: access.schoolId, subscriptionId: access.subscription.id, userId: access.userId, amount: 1, source: "ADMIN_AI_DRAFT", referenceId: created.id, idempotencyKey: `school-admin-draft:${created.id}`, description: `Draft AI: ${input.kind}` }, tx);
      }
      return created;
    });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && ["INSUFFICIENT_SCHOOL_CREDITS", "SCHOOL_CREDIT_CONFLICT"].includes(error.message)) return Response.json({ error: "Saldo kredit sekolah berubah atau tidak cukup.", code: error.message }, { status: 409 });
    return schoolCommercializationErrorResponse(error);
  }
}
