import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDocument } from "@/lib/ai/generate";
import { isTeacherProfileComplete } from "@/lib/teacher-profile";
import { spendCredits } from "@/lib/credit-ledger";
import { spendSchoolCredits } from "@/lib/school-credit-ledger";
import { attachUsageLogsToDocument } from "@/lib/ai/usage-tracking";
import { getToolFormSteps } from "@/lib/tool-forms";
import {
  canUseGenerator,
  countGenerateThisMonth,
  getUserPlanEntitlements,
} from "@/lib/plan-limits";
import { getGeneratorTool } from "@/lib/generator-catalog";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";
/** Modul ajar 2–3 fase AI butuh waktu lebih lama */
export const maxDuration = 180;

const schema = z.object({
  toolSlug: z.string().trim().min(1, "Generator wajib dipilih").max(80),
  data: z.record(z.unknown()).refine(
    (value) => value && typeof value === "object" && !Array.isArray(value),
    "Data generator tidak valid"
  ),
});

const MODUL_AJAR_REQUIRED_FIELDS = [
  "sekolah",
  "namaGuru",
  "semester",
  "tahunAjaran",
  "jumlahPertemuan",
] as const;

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return value !== null && value !== undefined;
}

function validateGeneratePayload(toolSlug: string, data: Record<string, unknown>) {
  const steps = getToolFormSteps(toolSlug);
  const fieldLabels = new Map(steps.flatMap((step) => step.fields.map((field) => [field.name, field.label])));
  const requiredFields = new Set(
    steps.flatMap((step) => step.fields.filter((field) => field.required).map((field) => field.name))
  );

  if (toolSlug === "modul-ajar") {
    for (const field of MODUL_AJAR_REQUIRED_FIELDS) {
      requiredFields.add(field);
    }
  }

  const missing = [...requiredFields].filter((field) => !hasMeaningfulValue(data[field]));
  if (missing.length > 0) {
    const labels = missing.map((field) => fieldLabels.get(field) || field);
    throw new Error(`Data ${toolSlug} belum lengkap: ${labels.join(", ")}.`);
  }

  if (toolSlug === "modul-ajar") {
    const jumlahPertemuan = Number(String(data.jumlahPertemuan ?? "").trim());
    if (!Number.isInteger(jumlahPertemuan) || jumlahPertemuan <= 0 || jumlahPertemuan > 16) {
      throw new Error("Jumlah Pertemuan harus berupa angka bulat antara 1 sampai 16.");
    }

    const topik = String(data.topik ?? "").trim();
    if (topik.length < 5) {
      throw new Error("Topik / Materi Pembelajaran minimal 5 karakter agar modul ajar tidak terlalu umum.");
    }

    const dpl = String(data.dimensiProfilLulusan ?? "")
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean);
    if (dpl.length === 0) {
      throw new Error("Pilih minimal 1 Dimensi Profil Lulusan.");
    }
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTeacherWorkspaceRole(session.user.role)) {
      return forbiddenRoleResponse("Hanya akun guru yang dapat menggunakan generator dokumen.");
    }

    const body = await req.json().catch(() => null);
    const { toolSlug, data } = schema.parse(body);

    const generatorTool = await getGeneratorTool(toolSlug);
    if (!generatorTool) {
      return NextResponse.json(
        { error: "Generator tidak dikenal.", code: "TOOL_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!generatorTool.isActive) {
      return NextResponse.json(
        { error: "Generator ini sedang dinonaktifkan oleh admin.", code: "TOOL_INACTIVE" },
        { status: 403 }
      );
    }

    validateGeneratePayload(toolSlug, data);

    const toolConfig = await prisma.aiToolConfig.findUnique({
      where: { toolSlug },
    });

    const creditCost = generatorTool.creditCost;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !isTeacherProfileComplete(user)
    ) {
      return NextResponse.json(
        {
          error:
            "Lengkapi profil guru (identitas, sekolah, mapel, periode, kurikulum) sebelum menggunakan generator.",
          code: "PROFILE_INCOMPLETE",
        },
        { status: 403 }
      );
    }

    let schoolAccess: Awaited<ReturnType<typeof getUserPlanEntitlements>>["schoolAccess"] = null;
    if (session.user.role !== "SUPER_ADMIN") {
      const access = await getUserPlanEntitlements(user.id);
      const { entitlements } = access;
      schoolAccess = access.schoolAccess;
      if (!canUseGenerator(entitlements, toolSlug)) {
        return NextResponse.json(
          {
            error: "Paket langganan Anda belum mencakup generator ini.",
            code: "GENERATOR_NOT_INCLUDED",
          },
          { status: 403 }
        );
      }

      if (entitlements.maxGeneratePerMonth !== null) {
        const usedThisMonth = await countGenerateThisMonth(user.id);
        if (usedThisMonth >= entitlements.maxGeneratePerMonth) {
          return NextResponse.json(
            {
              error: "Quota generate bulanan paket Anda sudah habis.",
              code: "MONTHLY_GENERATE_LIMIT_REACHED",
            },
            { status: 429 }
          );
        }
      }
    }

    const useSchoolCredits = Boolean(schoolAccess && schoolAccess.creditBalance >= creditCost);
    if (!useSchoolCredits && user.creditsRemaining < creditCost) {
      return NextResponse.json(
        {
          error:
            "Kredit tidak cukup. Dapatkan kredit gratis di menu Dapatkan Kredit atau upgrade paket.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    const result = await generateDocument({ toolSlug, data, userId: user.id });

    const { doc: document, balanceAfter } = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          userId: user.id,
          toolConfigId: toolConfig?.id,
          toolSlug,
          title: result.title,
          content: result.content,
          inputData: data as object,
          metadata: {
            providerUsed: result.providerUsed,
            isDemo: result.isDemo,
            creditCost,
            usageRequestId: result.usageRequestId,
            ...(result.meta || {}),
          },
          status: "DRAFT",
        },
      });

      const credit = useSchoolCredits && schoolAccess
        ? await spendSchoolCredits(
            {
              schoolId: schoolAccess.schoolId,
              subscriptionId: schoolAccess.subscriptionId,
              userId: user.id,
              amount: creditCost,
              source: "SPEND_GENERATE",
              referenceId: doc.id,
              idempotencyKey: `school-generate:${doc.id}`,
              description: `Generate: ${toolSlug}`,
            },
            tx
          )
        : await spendCredits(
            user.id,
            creditCost,
            "SPEND_GENERATE",
            doc.id,
            `Generate: ${toolSlug}`,
            tx
          );

      return { doc, balanceAfter: credit.balanceAfter };
    });

    if (result.usageRequestId) {
      try {
        await attachUsageLogsToDocument({
          requestId: result.usageRequestId,
          documentId: document.id,
          creditCharged: creditCost,
        });
      } catch (usageErr) {
        console.error("Attach AI usage log failed:", usageErr);
      }
    }

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        toolSlug: document.toolSlug,
        status: document.status,
        metadata: document.metadata,
      },
      creditsRemaining: useSchoolCredits ? user.creditsRemaining : balanceAfter,
      schoolCreditsRemaining: useSchoolCredits ? balanceAfter : schoolAccess?.creditBalance ?? null,
      creditSource: useSchoolCredits ? "school" : "personal",
      providerUsed: result.providerUsed,
      isDemo: result.isDemo,
      quality: result.meta,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }

    if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        {
          error:
            "Kredit tidak cukup. Saldo kredit Anda mungkin berubah saat proses generate berjalan.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    if (err instanceof Error && err.message === "CREDIT_CONFLICT") {
      return NextResponse.json(
        {
          error:
            "Saldo kredit berubah saat proses generate berjalan. Silakan coba ulang sebentar lagi.",
          code: "CREDIT_CONFLICT",
        },
        { status: 409 }
      );
    }

    console.error("Generate error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal generate" },
      { status: 500 }
    );
  }
}
