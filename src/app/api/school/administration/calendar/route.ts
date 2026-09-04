import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireSchoolCommercialization,
  schoolCommercializationErrorResponse,
} from "@/lib/school-commercialization-auth";

const schema = z.object({ title: z.string().trim().min(2).max(160), description: z.string().max(5000).optional(), startsAt: z.string().datetime(), endsAt: z.string().datetime() });

export async function GET() {
  try {
    const access = await requireSchoolCommercialization();
    const events = await prisma.schoolCalendarEvent.findMany({ where: { schoolId: access.schoolId }, orderBy: { startsAt: "asc" }, take: 500 });
    return Response.json({ events });
  } catch (error) {
    return schoolCommercializationErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireSchoolCommercialization({ write: true });
    const input = schema.parse(await request.json());
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) return Response.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
    const event = await prisma.schoolCalendarEvent.create({ data: { schoolId: access.schoolId, createdById: access.userId, title: input.title, description: input.description, startsAt, endsAt } });
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.errors[0].message }, { status: 400 });
    return schoolCommercializationErrorResponse(error);
  }
}
