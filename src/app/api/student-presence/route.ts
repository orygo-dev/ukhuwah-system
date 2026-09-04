import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presenceScope, presenceStatus, PRESENCE_PAGE_SIZE, PRESENCE_WINDOW_MS } from "@/lib/student-presence-policy";

export const dynamic = "force-dynamic";
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  q: z.string().trim().max(80).default(""),
  status: z.enum(["online", "all"]).default("online"),
}).strict();

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Silakan login kembali." }, { status: 401, headers });
    const scope = presenceScope(session.user);
    if (!scope) return NextResponse.json({ error: "Tidak memiliki akses pemantauan siswa." }, { status: 403, headers });
    const input = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!input.success) return NextResponse.json({ error: "Filter tidak valid." }, { status: 400, headers });
    const { page, q, status } = input.data;
    const now = new Date();
    const base = { AND: [scope, ...(q ? [{ OR: [
      { name: { contains: q } }, { classRoom: { name: { contains: q } } },
      { classRoom: { school: { name: { contains: q } } } },
    ] }] : [])] };
    const onlineWhere = { AND: [base, { presence: { is: {
      lastSeenAt: { gte: new Date(now.getTime() - PRESENCE_WINDOW_MS), lte: now },
    } } }] };
    const where = status === "online" ? onlineWhere : base;
    const [total, online, students] = await Promise.all([
      prisma.student.count({ where: base }),
      prisma.student.count({ where: onlineWhere }),
      prisma.student.findMany({ where, take: PRESENCE_PAGE_SIZE, skip: (page - 1) * PRESENCE_PAGE_SIZE,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true,
          classRoom: { select: { name: true, school: { select: { name: true } } } },
          presence: { select: { lastSeenAt: true } },
        },
      }),
    ]);
    return NextResponse.json({
      students: students.map((student) => ({
        id: student.id, name: student.name, className: student.classRoom.name,
        schoolName: student.classRoom.school?.name ?? null,
        lastSeenAt: student.presence?.lastSeenAt.toISOString() ?? null,
        status: presenceStatus(student.presence?.lastSeenAt ?? null, now),
      })), total, online, page, pageSize: PRESENCE_PAGE_SIZE,
      filteredTotal: status === "online" ? online : total, checkedAt: now.toISOString(),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Pemantauan belum tersedia. Pastikan migration sudah diterapkan." }, { status: 503, headers });
  }
}
