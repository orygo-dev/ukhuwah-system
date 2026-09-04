import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { OtpPurpose } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credit-ledger";
import { readRequestJson } from "@/lib/http-json";
import {
  currentTahunAjaran,
  serializeTeacherProfile,
  validateTeacherProfile,
} from "@/lib/teacher-profile";
import { teachingProfileFromSchool } from "@/lib/teacher-school-profiles";
import { normalizeWhatsappNumber, verifyOtpCode } from "@/lib/whatsapp";
import { JENJANG_OPTIONS, getMapelOptions } from "@/lib/curriculum";
import {
  clientAddress,
  consumeSecurityRateLimit,
  rateLimitHeaders,
} from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().min(8, "Nomor WhatsApp wajib diisi"),
  schoolId: z.string().min(1, "Sekolah wajib dipilih"),
  jenjang: z.string().min(1, "Jenjang wajib dipilih"),
  mapel: z.string().min(1, "Mata pelajaran wajib dipilih"),
  referralCode: z.string().optional(),
  otpCode: z.string().trim().regex(/^\d{4,8}$/, "Kode OTP wajib dan harus 4–8 digit"),
});

export async function POST(req: Request) {
  try {
    const raw = await readRequestJson(req);
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "Data pendaftaran tidak valid" }, { status: 400 });
    }
    const data = schema.parse(raw);
    const rate = await consumeSecurityRateLimit({
      bucket: "register-ip",
      identity: clientAddress(req.headers),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti." },
        { status: 429, headers: rateLimitHeaders(rate) },
      );
    }
    const phone = normalizeWhatsappNumber(data.phone);
    const validJenjang = JENJANG_OPTIONS.some((option) => option.value === data.jenjang);
    const validMapel = getMapelOptions(data.jenjang).some((option) => option.value === data.mapel);

    if (!phone || phone.length < 9) {
      return NextResponse.json({ error: "Nomor WhatsApp tidak valid" }, { status: 400 });
    }
    if (!validJenjang) {
      return NextResponse.json({ error: "Jenjang tidak valid" }, { status: 400 });
    }
    if (!validMapel) {
      return NextResponse.json({ error: "Mata pelajaran tidak sesuai jenjang" }, { status: 400 });
    }

    const otpResult = await verifyOtpCode({
      phone,
      purpose: OtpPurpose.REGISTER,
      code: data.otpCode,
      consume: true,
    });
    if (!otpResult.ok) {
      return NextResponse.json(
        { error: "Kode OTP tidak valid atau sudah kedaluwarsa. Minta OTP baru." },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (exists) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { slug: "free" },
    });
    const school = await prisma.school.findUnique({
      where: { id: data.schoolId },
      include: { regency: { include: { province: true } } },
    });
    if (!school) {
      return NextResponse.json({ error: "Sekolah tidak ditemukan" }, { status: 400 });
    }
    const profile = {
      namaGuru: data.name.trim(),
      phone,
      schoolId: school.id,
      sekolah: school.name,
      npsn: school.npsn || "",
      alamatSekolah: school.address || "",
      kota: school.regency?.name || school.city || "",
      provinsi: school.regency?.province?.name || school.province || "",
      jenjang: data.jenjang,
      mapel: data.mapel,
      tahunAjaran: currentTahunAjaran(),
      semester: "Ganjil",
      kurikulum: "merdeka-dl",
    };
    const validation = validateTeacherProfile(profile);
    const profileDefaults = serializeTeacherProfile(profile, validation.complete);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase(),
          passwordHash,
          phone,
          schoolId: school.id,
          profileDefaults,
          creditsRemaining: 0,
          planId: freePlan?.id,
        },
        select: { id: true, email: true, name: true },
      });

      await tx.teacherSchoolProfile.create({
        data: {
          ...teachingProfileFromSchool({
            school,
            jenjang: data.jenjang,
            mapel: data.mapel,
            tahunAjaran: profile.tahunAjaran,
            semester: profile.semester,
            isPrimary: true,
          }),
          userId: created.id,
        },
      });

      await grantCredits(
        created.id,
        10,
        "REGISTRATION",
        created.id,
        "Bonus pendaftaran akun baru",
        tx
      );

      if (data.referralCode?.trim()) {
        const code = data.referralCode.trim().toUpperCase();
        const affiliate = await tx.user.findFirst({
          where: { referralCode: code },
          select: { id: true },
        });
        if (affiliate && affiliate.id !== created.id) {
          const existingReferral = await tx.affiliateReferral.findUnique({
            where: { referredUserId: created.id },
          });
          if (!existingReferral) {
            await tx.user.update({
              where: { id: created.id },
              data: { referredById: affiliate.id },
            });
            await tx.affiliateReferral.create({
              data: {
                affiliateId: affiliate.id,
                referredUserId: created.id,
                referralCode: code,
              },
            });
          }
        }
      }

      return created;
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    console.error("Register error:", err);
    return NextResponse.json({ error: "Gagal mendaftar" }, { status: 500 });
  }
}
