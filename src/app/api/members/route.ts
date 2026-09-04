import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeMember } from "@/lib/member-directory";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Direktori member hanya tersedia untuk akun guru.");
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() || "";
  const jenjang = searchParams.get("jenjang")?.trim() || "";
  const mapel = searchParams.get("mapel")?.trim().toLowerCase() || "";
  const rawPage = Number(searchParams.get("page") || 1);
  const rawLimit = Number(searchParams.get("limit") || 24);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(48, Math.max(12, Math.trunc(rawLimit)))
    : 24;

  const teachers = await prisma.user.findMany({
    where: { role: UserRole.TEACHER },
    include: {
      school: true,
      plan: { select: { name: true, slug: true } },
      classRooms: {
        where: { isActive: true },
        orderBy: [{ tahunAjaran: "desc" }, { name: "asc" }],
        take: 8,
      },
    },
    orderBy: { name: "asc" },
  });

  let members = teachers.map(serializeMember);

  if (q) {
    members = members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.schoolName.toLowerCase().includes(q) ||
        m.mapel.toLowerCase().includes(q) ||
        m.classes.some((c) => c.name.toLowerCase().includes(q))
    );
  }
  if (jenjang) {
    members = members.filter(
      (m) => m.jenjang.toLowerCase() === jenjang.toLowerCase()
    );
  }
  if (mapel) {
    members = members.filter((m) => m.mapel.toLowerCase().includes(mapel));
  }

  const total = members.length;
  const start = (page - 1) * limit;
  const paged = members.slice(start, start + limit);

  const mapelOptions = [
    ...new Set(
      teachers
        .map((t) => serializeMember(t).mapel)
        .filter((m) => m && m !== "—")
    ),
  ].sort();

  const jenjangOptions = [
    ...new Set(
      teachers
        .map((t) => serializeMember(t).jenjang)
        .filter((j) => j && j !== "—")
    ),
  ].sort();

  return NextResponse.json({
    members: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
    filters: { mapelOptions, jenjangOptions },
    stats: { totalMembers: teachers.length },
  });
}
