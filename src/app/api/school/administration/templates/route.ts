import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.enum(["LETTER", "DECREE", "WORK_PROGRAM", "MEETING_MINUTES", "REPORT", "SUPERVISION", "OTHER"]),
  titleTemplate: z.string().trim().min(2).max(200),
  contentTemplate: z.string().trim().min(1).max(200000),
});

export async function GET() {
  try {
    const access = await requireSchoolCommercialization();
    const [templates, branding] = await Promise.all([
      prisma.schoolDocumentTemplate.findMany({ where: { schoolId: access.schoolId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.school.findUnique({ where: { id: access.schoolId }, select: { name: true, npsn: true, address: true, logoUrl: true } }),
    ]);
    return Response.json({ templates, branding });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    const input = schema.parse(await request.json());
    const template = await prisma.schoolDocumentTemplate.create({ data: { ...input, schoolId: access.schoolId, createdById: access.userId } });
    return Response.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    if (error instanceof Error && "code" in error && error.code === "P2002") return Response.json({ error: "Nama template sudah digunakan." }, { status: 409 });
    return schoolCommercializationErrorResponse(error);
  }
}
