import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  SCHOOL_WITH_REGION_INCLUDE,
  serializeProvince,
  serializeRegency,
  serializeSchool,
} from "@/lib/school-directory";

const entitySchema = z.enum(["province", "regency", "school"]);

const provinceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama provinsi wajib diisi"),
  code: z.string().optional().nullable(),
});

const regencySchema = z.object({
  id: z.string().optional(),
  provinceId: z.string().min(1, "Provinsi wajib dipilih"),
  name: z.string().min(2, "Nama kabupaten/kota wajib diisi"),
  code: z.string().optional().nullable(),
  type: z.string().min(1, "Tipe wajib dipilih"),
});

const schoolSchema = z.object({
  id: z.string().optional(),
  regencyId: z.string().min(1, "Kabupaten/kota wajib dipilih"),
  name: z.string().min(2, "Nama sekolah wajib diisi"),
  npsn: z.string().optional().nullable(),
  level: z.string().min(1, "Jenjang sekolah wajib dipilih"),
  address: z.string().optional().nullable(),
});

function cleanText(value?: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

function adminError(err: unknown) {
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: err.errors[0]?.message || "Data tidak valid" },
      { status: 400 }
    );
  }
  const msg = err instanceof Error ? err.message : "Forbidden";
  if (msg === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (msg === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (msg.startsWith("DATA_IN_USE:")) {
    return NextResponse.json({ error: msg.replace("DATA_IN_USE:", "") }, { status: 409 });
  }
  if (msg.startsWith("NOT_FOUND:")) {
    return NextResponse.json({ error: msg.replace("NOT_FOUND:", "") }, { status: 404 });
  }
  return NextResponse.json({ error: "Gagal memproses data" }, { status: 500 });
}

async function getPayload() {
  const [provinces, regencies, schools, totalSchools] = await Promise.all([
    prisma.province.findMany({
      include: {
        _count: { select: { regencies: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.regency.findMany({
      include: {
        province: { select: { name: true } },
        _count: { select: { schools: true } },
      },
      orderBy: [{ province: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.school.findMany({
      include: SCHOOL_WITH_REGION_INCLUDE,
      orderBy: [{ name: "asc" }],
    }),
    prisma.school.count(),
  ]);

  return {
    stats: {
      totalProvinces: provinces.length,
      totalRegencies: regencies.length,
      totalSchools,
      returnedSchools: schools.length,
    },
    provinces: provinces.map((province) => ({
      ...serializeProvince(province),
      regenciesCount: province._count.regencies,
    })),
    regencies: regencies.map((regency) => ({
      ...serializeRegency(regency),
      schoolsCount: regency._count.schools,
    })),
    schools: schools.map(serializeSchool),
  };
}

export async function GET() {
  try {
    await requireSuperAdmin();
    return NextResponse.json(await getPayload());
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const entity = entitySchema.parse(body.entity);

    if (entity === "province") {
      const parsed = provinceSchema.parse(body);
      await prisma.province.create({
        data: {
          name: parsed.name.trim(),
          code: cleanText(parsed.code),
        },
      });
    }

    if (entity === "regency") {
      const parsed = regencySchema.parse(body);
      await prisma.regency.create({
        data: {
          provinceId: parsed.provinceId,
          name: parsed.name.trim(),
          code: cleanText(parsed.code),
          type: parsed.type.trim(),
        },
      });
    }

    if (entity === "school") {
      const parsed = schoolSchema.parse(body);
      const regency = await prisma.regency.findUnique({
        where: { id: parsed.regencyId },
        include: { province: true },
      });
      if (!regency) throw new Error("NOT_FOUND:Kabupaten/kota tidak ditemukan");

      await prisma.school.create({
        data: {
          regencyId: regency.id,
          name: parsed.name.trim(),
          npsn: cleanText(parsed.npsn),
          level: parsed.level.trim(),
          address: cleanText(parsed.address),
          city: regency.name,
          province: regency.province.name,
        },
      });
    }

    return NextResponse.json(await getPayload());
  } catch (err) {
    return adminError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSuperAdmin();
    const body = await req.json();
    const entity = entitySchema.parse(body.entity);

    if (entity === "province") {
      const parsed = provinceSchema.extend({ id: z.string().min(1) }).parse(body);
      await prisma.province.update({
        where: { id: parsed.id },
        data: {
          name: parsed.name.trim(),
          code: cleanText(parsed.code),
        },
      });
    }

    if (entity === "regency") {
      const parsed = regencySchema.extend({ id: z.string().min(1) }).parse(body);
      await prisma.regency.update({
        where: { id: parsed.id },
        data: {
          provinceId: parsed.provinceId,
          name: parsed.name.trim(),
          code: cleanText(parsed.code),
          type: parsed.type.trim(),
        },
      });
      const updated = await prisma.regency.findUnique({
        where: { id: parsed.id },
        include: { province: true },
      });
      if (updated) {
        await prisma.school.updateMany({
          where: { regencyId: updated.id },
          data: { city: updated.name, province: updated.province.name },
        });
      }
    }

    if (entity === "school") {
      const parsed = schoolSchema.extend({ id: z.string().min(1) }).parse(body);
      const regency = await prisma.regency.findUnique({
        where: { id: parsed.regencyId },
        include: { province: true },
      });
      if (!regency) throw new Error("NOT_FOUND:Kabupaten/kota tidak ditemukan");

      await prisma.school.update({
        where: { id: parsed.id },
        data: {
          regencyId: regency.id,
          name: parsed.name.trim(),
          npsn: cleanText(parsed.npsn),
          level: parsed.level.trim(),
          address: cleanText(parsed.address),
          city: regency.name,
          province: regency.province.name,
        },
      });
    }

    return NextResponse.json(await getPayload());
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireSuperAdmin();
    const url = new URL(req.url);
    const body = await req.json().catch(() => null);

    // Bulk delete schools: { entity: "school", ids: string[] }
    if (body && Array.isArray(body.ids)) {
      const entity = entitySchema.parse(body.entity ?? "school");
      if (entity !== "school") {
        return NextResponse.json(
          { error: "Bulk hapus saat ini hanya tersedia untuk sekolah." },
          { status: 400 }
        );
      }
      const ids = z.array(z.string().min(1)).min(1).max(200).parse(body.ids);
      const uniqueIds = Array.from(new Set(ids));

      const schools = await prisma.school.findMany({
        where: { id: { in: uniqueIds } },
        select: {
          id: true,
          name: true,
          _count: { select: { users: true, classRooms: true } },
        },
      });

      const deletableIds: string[] = [];
      const skipped: { id: string; name: string; reason: string }[] = [];
      for (const school of schools) {
        if (school._count.users > 0 || school._count.classRooms > 0) {
          skipped.push({
            id: school.id,
            name: school.name,
            reason: "Sudah dipakai guru atau kelas",
          });
          continue;
        }
        deletableIds.push(school.id);
      }

      const missing = uniqueIds.filter(
        (id) => !schools.some((school) => school.id === id)
      );
      for (const id of missing) {
        skipped.push({ id, name: id, reason: "Sekolah tidak ditemukan" });
      }

      if (deletableIds.length > 0) {
        await prisma.school.deleteMany({ where: { id: { in: deletableIds } } });
      }

      return NextResponse.json({
        ...(await getPayload()),
        bulk: {
          requested: uniqueIds.length,
          deleted: deletableIds.length,
          skipped,
        },
      });
    }

    const entity = entitySchema.parse(url.searchParams.get("entity"));
    const id = z.string().min(1).parse(url.searchParams.get("id"));

    if (entity === "province") {
      const count = await prisma.regency.count({ where: { provinceId: id } });
      if (count > 0) {
        throw new Error("DATA_IN_USE:Hapus atau pindahkan kabupaten/kota di provinsi ini terlebih dahulu");
      }
      await prisma.province.delete({ where: { id } });
    }

    if (entity === "regency") {
      const count = await prisma.school.count({ where: { regencyId: id } });
      if (count > 0) {
        throw new Error("DATA_IN_USE:Hapus atau pindahkan sekolah di kabupaten/kota ini terlebih dahulu");
      }
      await prisma.regency.delete({ where: { id } });
    }

    if (entity === "school") {
      const usage = await prisma.school.findUnique({
        where: { id },
        select: {
          _count: { select: { users: true, classRooms: true } },
        },
      });
      if (!usage) throw new Error("NOT_FOUND:Sekolah tidak ditemukan");
      if (usage._count.users > 0 || usage._count.classRooms > 0) {
        throw new Error("DATA_IN_USE:Sekolah sudah dipakai oleh guru atau kelas dan tidak bisa dihapus");
      }
      await prisma.school.delete({ where: { id } });
    }

    return NextResponse.json(await getPayload());
  } catch (err) {
    return adminError(err);
  }
}
