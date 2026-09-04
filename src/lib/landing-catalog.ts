import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type CatalogAudience = "guru" | "sekolah";
export type PublicPlan = {
  name: string;
  slug: string;
  description: string | null;
  monthly: number;
  yearly?: number;
  benefits: string[];
};
export type PublicCatalog = {
  status: "ready" | "empty" | "unavailable" | "disabled";
  plans: PublicPlan[];
};

function featureObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}
function price(value: unknown) {
  const result = Number(value);
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(result) ||
    result < 0
  ) {
    throw new Error("Invalid catalog price");
  }
  return result;
}
function benefits(value: unknown, school: boolean) {
  const features = featureObject(value);
  const names = school
    ? {
        administration: "Administrasi sekolah",
        ai_drafts: "Draf administrasi berbantuan AI",
        scheduling: "Penjadwalan pengajar",
        teacher_generators: "Akses generator bagi guru yang ditugaskan",
        export_pdf: "Ekspor PDF",
        export_docx: "Ekspor DOCX",
        pjj_add_on: "Mendukung add-on PJJ (aktivasi terpisah)",
      }
    : {
        export_pdf: "Ekspor PDF",
        export_docx: "Ekspor DOCX",
        can_use_ai_assistant: "Asisten AI",
        can_use_premium_generators: "Akses generator premium",
      };
  return Object.entries(names)
    .filter(([key]) => features[key] === true)
    .map(([, label]) => label);
}

/** Read-only public projection, request-deduplicated; no invoices, account data or checkout calls. */
export const getPublicCatalog = cache(
  async (audience: CatalogAudience): Promise<PublicCatalog> => {
    if (
      audience === "sekolah" &&
      process.env.SCHOOL_COMMERCIALIZATION_ENABLED !== "true"
    ) {
      return { status: "disabled", plans: [] };
    }
    try {
      let plans: PublicPlan[];
      if (audience === "guru") {
        const rows = await prisma.subscriptionPlan.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            name: true,
            slug: true,
            description: true,
            priceMonthly: true,
            creditsMonthly: true,
            features: true,
          },
        });
        plans = rows.map((row) => {
          const bonus = number(
            featureObject(row.features).monthly_credit_bonus,
          );
          return {
            name: row.name,
            slug: row.slug,
            description: row.description,
            monthly: price(row.priceMonthly),
            // The existing teacher checkout supports monthly pricing only.
            benefits: [
              `${row.creditsMonthly} kredit/bulan`,
              ...(bonus > 0 ? [`Bonus ${bonus} kredit/bulan`] : []),
              ...benefits(row.features, false),
            ],
          };
        });
      } else {
        const rows = await prisma.schoolPlan.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            name: true,
            slug: true,
            description: true,
            priceMonthly: true,
            priceYearly: true,
            maxTeacherSeats: true,
            maxStudents: true,
            monthlyAiCredits: true,
            features: true,
          },
        });
        plans = rows.map((row) => ({
          name: row.name,
          slug: row.slug,
          description: row.description,
          monthly: price(row.priceMonthly),
          yearly: price(row.priceYearly),
          benefits: [
            `Kapasitas ${row.maxTeacherSeats} guru`,
            `Kapasitas ${row.maxStudents} siswa`,
            `${row.monthlyAiCredits} kredit AI/bulan`,
            ...benefits(row.features, true),
          ],
        }));
      }
      return { status: plans.length ? "ready" : "empty", plans };
    } catch {
      // No legacy/fake prices and no raw database errors or credentials in public HTML.
      return { status: "unavailable", plans: [] };
    }
  },
);
