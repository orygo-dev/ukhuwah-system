import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { encrypt } from "../src/lib/encryption";
import { TOOL_PROMPTS } from "../src/lib/ai/prompts";
import { AI_PROVIDERS } from "../src/lib/ai/constants";
import { DEFAULT_LANDING_PAGE, LANDING_PAGE_KEY } from "../src/lib/landing-page";
import {
  AFFILIATE_CONFIG_KEY,
  DEFAULT_AFFILIATE_CONFIG,
} from "../src/lib/affiliate";
import {
  DEFAULT_REWARD_CONFIG,
  REWARD_CONFIG_KEY,
} from "../src/lib/reward";
import {
  DEFAULT_REWARD_AD_CONFIG,
  REWARD_AD_CONFIG_KEY,
} from "../src/lib/reward-ad";
import {
  APP_DISPLAY_KEY,
  DEFAULT_APP_DISPLAY,
} from "../src/lib/app-display.shared";

if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "Demo seed dinonaktifkan. Set ALLOW_DEMO_SEED=true hanya pada database development/testing yang aman.",
  );
}

const prisma = new PrismaClient();

async function seedProvider(
  slug: keyof typeof AI_PROVIDERS,
  envKey: string,
  opts: { isActive?: boolean; isFallback?: boolean; priority: number }
) {
  const catalog = AI_PROVIDERS[slug];
  const key = process.env[envKey] || "";
  return prisma.aiProvider.upsert({
    where: { slug },
    create: {
      name: catalog.name,
      slug,
      baseUrl: catalog.baseUrl,
      apiKey: key ? encrypt(key) : encrypt("placeholder"),
      defaultModel: catalog.defaultModel,
      isActive: opts.isActive ?? !!key,
      isFallback: opts.isFallback ?? false,
      maxTokens: 4096,
      temperature: 0.7,
      priority: opts.priority,
    },
    update: {
      ...(key ? { apiKey: encrypt(key), isActive: true } : {}),
      baseUrl: catalog.baseUrl,
      defaultModel: catalog.defaultModel,
    },
  });
}

async function main() {
  console.log("Seeding Navalogi...");

  const plans = [
    {
      name: "Gratis",
      slug: "free",
      description: "10 dokumen welcome",
      priceMonthly: 0,
      priceYearly: 0,
      creditsMonthly: 10,
      features: { export_pdf: true, export_docx: true },
      sortOrder: 0,
    },
    {
      name: "Starter",
      slug: "starter",
      description: "50 generate per bulan",
      priceMonthly: 49000,
      priceYearly: 490000,
      creditsMonthly: 50,
      features: { export_pdf: true, export_docx: true, priority: false },
      sortOrder: 1,
    },
    {
      name: "Pro",
      slug: "pro",
      description: "250 generate per bulan",
      priceMonthly: 149000,
      priceYearly: 1490000,
      creditsMonthly: 250,
      isPopular: true,
      features: { export_pdf: true, export_docx: true, priority: true },
      sortOrder: 2,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
  }

  const creditPackages = [
    {
      name: "Paket Hemat",
      slug: "hemat-25",
      description: "Cocok untuk kebutuhan dokumen mingguan.",
      credits: 25,
      bonusCredits: 0,
      price: 15000,
      sortOrder: 0,
      isPopular: false,
      isActive: true,
    },
    {
      name: "Paket Produktif",
      slug: "produktif-60",
      description: "Pilihan seimbang untuk guru aktif.",
      credits: 55,
      bonusCredits: 5,
      price: 29000,
      sortOrder: 1,
      isPopular: true,
      isActive: true,
    },
    {
      name: "Paket Sekolah",
      slug: "sekolah-150",
      description: "Kredit besar untuk administrasi kelas dan asesmen.",
      credits: 130,
      bonusCredits: 20,
      price: 69000,
      sortOrder: 2,
      isPopular: false,
      isActive: true,
    },
  ];

  for (const pkg of creditPackages) {
    await prisma.creditPackage.upsert({
      where: { slug: pkg.slug },
      create: pkg,
      update: pkg,
    });
  }

  const openai = await seedProvider("openai", "OPENAI_API_KEY", {
    isActive: !!process.env.OPENAI_API_KEY,
    priority: 30,
  });
  await seedProvider("gemini", "GEMINI_API_KEY", {
    isFallback: true,
    isActive: false,
    priority: 20,
  });
  await seedProvider("openrouter", "OPENROUTER_API_KEY", {
    isFallback: true,
    priority: 25,
  });

  const provider = openai;

  const tools = [
    { slug: "modul-ajar", name: "Modul Ajar / RPP", category: "perangkat-ajar", credits: 2 },
    { slug: "bank-soal", name: "Bank Soal", category: "asesmen", credits: 1 },
    { slug: "lkpd", name: "LKPD", category: "perangkat-ajar", credits: 1 },
    { slug: "jurnal-mengajar", name: "Jurnal Mengajar", category: "kelas", credits: 1 },
    { slug: "narasi-rapor", name: "Narasi Rapor", category: "asesmen", credits: 1 },
    { slug: "surat-dinas", name: "Surat Dinas", category: "administrasi", credits: 1 },
    { slug: "prota", name: "Program Tahunan", category: "perangkat-ajar", credits: 2 },
    { slug: "prosem", name: "Program Semester", category: "perangkat-ajar", credits: 2 },
  ];

  for (const [i, tool] of tools.entries()) {
    await prisma.aiToolConfig.upsert({
      where: { toolSlug: tool.slug },
      create: {
        toolSlug: tool.slug,
        toolName: tool.name,
        category: tool.category,
        providerId: provider.id,
        systemPrompt: TOOL_PROMPTS[tool.slug] || TOOL_PROMPTS["modul-ajar"],
        creditCost: tool.credits,
        sortOrder: i,
      },
      update: {
        toolName: tool.name,
        creditCost: tool.credits,
        systemPrompt: TOOL_PROMPTS[tool.slug] || TOOL_PROMPTS["modul-ajar"],
      },
    });
  }

  await prisma.paymentGateway.upsert({
    where: { slug: "midtrans" },
    create: {
      name: "Midtrans",
      slug: "midtrans",
      isActive: true,
      isDefault: true,
      isSandbox: true,
      config: {
        serverKey: encrypt(process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-placeholder"),
        clientKey: encrypt(process.env.MIDTRANS_CLIENT_KEY || "SB-Mid-client-placeholder"),
      },
      supportedMethods: ["qris", "va", "gopay", "ovo", "shopeepay"],
    },
    update: {},
  });

  await prisma.paymentGateway.upsert({
    where: { slug: "tripay" },
    create: {
      name: "Tripay",
      slug: "tripay",
      isActive: false,
      isDefault: false,
      isSandbox: true,
      config: { apiKey: "", privateKey: "", merchantCode: "" },
      supportedMethods: ["qris", "va", "ewallet"],
    },
    update: {},
  });

  const adminPassword = await bcrypt.hash("admin123456", 12);
  await prisma.user.upsert({
    where: { email: "admin@guruspace.id" },
    create: {
      email: "admin@guruspace.id",
      name: "Super Admin",
      passwordHash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      creditsRemaining: 9999,
    },
    update: {},
  });

  const teacherPassword = await bcrypt.hash("guru123456", 12);
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { slug: "free" } });

  const dkiJakarta = await prisma.province.upsert({
    where: { name: "DKI Jakarta" },
    create: { name: "DKI Jakarta", code: "31" },
    update: { code: "31" },
  });
  const kotaJakarta = await prisma.regency.upsert({
    where: { provinceId_name: { provinceId: dkiJakarta.id, name: "Jakarta" } },
    create: {
      provinceId: dkiJakarta.id,
      name: "Jakarta",
      code: "31.71",
      type: "Kota",
    },
    update: { code: "31.71", type: "Kota" },
  });

  const demoSchool = await prisma.school.upsert({
    where: { npsn: "20100101" },
    create: {
      name: "SMP Negeri 1 Jakarta",
      npsn: "20100101",
      level: "SMP/MTs",
      city: "Jakarta",
      province: "DKI Jakarta",
      regencyId: kotaJakarta.id,
    },
    update: {
      city: "Jakarta",
      province: "DKI Jakarta",
      regencyId: kotaJakarta.id,
      level: "SMP/MTs",
    },
  });

  const demoTeacher = await prisma.user.upsert({
    where: { email: "guru@demo.sch.id" },
    create: {
      email: "guru@demo.sch.id",
      name: "Bu Sinta Rahayu",
      passwordHash: teacherPassword,
      role: UserRole.TEACHER,
      schoolId: demoSchool.id,
      creditsRemaining: 42,
      planId: freePlan?.id,
      profileDefaults: {
        namaGuru: "Bu Sinta Rahayu",
        sekolah: "SMP Negeri 1 Jakarta",
        kurikulum: "merdeka-dl",
        jenjang: "smp",
        mapel: "Matematika",
        tahunAjaran: "2025/2026",
        semester: "Ganjil",
        profileCompletedAt: new Date().toISOString(),
      },
    },
    update: {
      schoolId: demoSchool.id,
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Sinta&backgroundColor=b6e3f4",
      profileDefaults: {
        namaGuru: "Bu Sinta Rahayu",
        sekolah: "SMP Negeri 1 Jakarta",
        kurikulum: "merdeka-dl",
        jenjang: "smp",
        mapel: "Matematika",
        tahunAjaran: "2025/2026",
        semester: "Ganjil",
        profileCompletedAt: new Date().toISOString(),
      },
    },
  });

  const demoClass = await prisma.classRoom.upsert({
    where: {
      teacherId_name_tahunAjaran: {
        teacherId: demoTeacher.id,
        name: "8A",
        tahunAjaran: "2025/2026",
      },
    },
    create: {
      teacherId: demoTeacher.id,
      schoolId: demoSchool.id,
      name: "8A",
      jenjang: "smp",
      tahunAjaran: "2025/2026",
    },
    update: {},
  });

  const demoStudents = [
    { nis: "2025001", name: "Andi Pratama", gender: "L" },
    { nis: "2025002", name: "Budi Santoso", gender: "L" },
    { nis: "2025003", name: "Citra Dewi", gender: "P" },
    { nis: "2025004", name: "Dian Permata", gender: "P" },
    { nis: "2025005", name: "Eko Wijaya", gender: "L" },
  ];

  const existingCount = await prisma.student.count({
    where: { classRoomId: demoClass.id },
  });

  if (existingCount === 0) {
    await prisma.student.createMany({
      data: demoStudents.map((s) => ({
        classRoomId: demoClass.id,
        ...s,
      })),
    });
  }

  const journalCount = await prisma.dailyJournal.count({
    where: { teacherId: demoTeacher.id },
  });
  if (journalCount === 0) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.dailyJournal.createMany({
      data: [
        {
          teacherId: demoTeacher.id,
          classRoomId: demoClass.id,
          date: today,
          mapel: "Matematika",
          jamKe: 3,
          materi: "Persamaan Linear Satu Variabel",
          tujuanPembelajaran:
            "Siswa dapat menyelesaikan persamaan linear satu variabel sederhana.",
          kegiatan:
            "Apersepsi: review konsep variabel. Inti: penjelasan metode substitusi dan eliminasi. Latihan berpasangan. Penutup: refleksi kelompok.",
          evaluasi: "80% siswa menyelesaikan LKPD dengan benar.",
          refleksi: "Siswa aktif saat latihan berpasangan. Perlu lebih banyak contoh kontekstual.",
          tindakLanjut: "Review materi untuk 5 siswa yang masih kesulitan.",
          status: "FINAL",
        },
        {
          teacherId: demoTeacher.id,
          classRoomId: demoClass.id,
          date: yesterday,
          mapel: "Matematika",
          jamKe: 2,
          materi: "Konsep Variabel dan Konstanta",
          kegiatan:
            "Diskusi kelompok tentang contoh variabel di kehidupan sehari-hari. Presentasi kelompok.",
          evaluasi: "Partisipasi siswa baik, 2 kelompok presentasi.",
          refleksi: "Waktu presentasi perlu dibatasi agar lebih efisien.",
          status: "FINAL",
        },
      ],
    });
  }

  const assessmentCount = await prisma.assessment.count({
    where: { teacherId: demoTeacher.id },
  });
  if (assessmentCount === 0) {
    const students = await prisma.student.findMany({
      where: { classRoomId: demoClass.id, isActive: true },
    });
    const quizDate = new Date();
    quizDate.setDate(quizDate.getDate() - 3);

    const assessment = await prisma.assessment.create({
      data: {
        teacherId: demoTeacher.id,
        classRoomId: demoClass.id,
        title: "ULH Bab 1 — Aljabar",
        mapel: "Matematika",
        type: "QUIZ",
        date: quizDate,
        semester: "Ganjil",
        tahunAjaran: "2025/2026",
        maxScore: 100,
        status: "FINAL",
        gradeRecords: {
          create: students.map((s, i) => ({
            studentId: s.id,
            score: [88, 76, 92, 85, 70][i % 5] ?? 80,
          })),
        },
      },
    });

    const tugasDate = new Date();
    tugasDate.setDate(tugasDate.getDate() - 1);
    await prisma.assessment.create({
      data: {
        teacherId: demoTeacher.id,
        classRoomId: demoClass.id,
        title: "Tugas Kelompok — Soal Cerita",
        mapel: "Matematika",
        type: "TUGAS",
        date: tugasDate,
        semester: "Ganjil",
        tahunAjaran: "2025/2026",
        maxScore: 100,
        status: "DRAFT",
        gradeRecords: {
          create: students.map((s, i) => ({
            studentId: s.id,
            score: i < 3 ? [90, 82, 78][i] : null,
          })),
        },
      },
    });

    void assessment;
  }

  await prisma.assessment.updateMany({
    where: { classRoomId: demoClass.id, semester: null },
    data: { semester: "Ganjil", tahunAjaran: "2025/2026" },
  });

  const demoStudent = await prisma.student.findFirst({
    where: { classRoomId: demoClass.id, isActive: true },
    orderBy: { name: "asc" },
  });
  if (demoStudent && !demoStudent.parentAccessEnabled) {
    await prisma.student.update({
      where: { id: demoStudent.id },
      data: {
        parentAccessCodeHash: await bcrypt.hash("DEMO8A01", 10),
        parentAccessEnabled: true,
      },
    });
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@guruspace.id" },
  });

  const spotlightSeeds = [
    {
      authorId: demoTeacher.id,
      caption:
        "Tips cepat buat Modul Ajar Kurikulum Merdeka dalam 5 menit pakai AI — hemat begadang! 🎯",
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    {
      authorId: demoTeacher.id,
      caption:
        "Trik membuat bank soal HOTS yang menantang tapi fair untuk siswa SMP. Siapa yang sudah coba?",
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    },
    {
      authorId: adminUser?.id || demoTeacher.id,
      caption:
        "Selamat datang di Spotlight Navalogi! Bagikan video pendek inspirasi mengajar Anda di sini. ✨",
      videoUrl:
        "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    },
  ];

  for (const seed of spotlightSeeds) {
    const exists = await prisma.spotlightPost.findFirst({
      where: { authorId: seed.authorId, caption: seed.caption },
    });
    if (!exists) {
      await prisma.spotlightPost.create({ data: seed });
    }
  }

  await prisma.platformSetting.upsert({
    where: { key: LANDING_PAGE_KEY },
    create: { key: LANDING_PAGE_KEY, value: DEFAULT_LANDING_PAGE as object },
    update: {},
  });

  await prisma.platformSetting.upsert({
    where: { key: APP_DISPLAY_KEY },
    create: { key: APP_DISPLAY_KEY, value: DEFAULT_APP_DISPLAY as object },
    update: {},
  });

  const existingAffiliate = await prisma.platformSetting.findUnique({
    where: { key: AFFILIATE_CONFIG_KEY },
  });
  const affiliateConfigValue = {
    ...DEFAULT_AFFILIATE_CONFIG,
    ...(existingAffiliate?.value && typeof existingAffiliate.value === "object"
      ? (existingAffiliate.value as object)
      : {}),
    commissionOn: "all_payments" as const,
    commissionTargets: ["subscription"],
    partnerCommissionEnabled: true,
    maxTotalCommissionPercent: 15,
  };

  await prisma.platformSetting.upsert({
    where: { key: AFFILIATE_CONFIG_KEY },
    create: { key: AFFILIATE_CONFIG_KEY, value: affiliateConfigValue as object },
    update: { value: affiliateConfigValue as object },
  });

  const demoTeacherWithCode = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
  });
  if (demoTeacherWithCode) {
    await prisma.user.update({
      where: { id: demoTeacherWithCode.id },
      data: {
        referralCode: demoTeacherWithCode.referralCode || "GS-SINTA-DEMO",
      },
    });
    await prisma.affiliateProfile.upsert({
      where: { userId: demoTeacherWithCode.id },
      create: { userId: demoTeacherWithCode.id, isActive: true },
      update: {},
    });
  }

  const affiliateTeacher = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
  });
  const starterPlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "starter" },
  });
  const proPlan = await prisma.subscriptionPlan.findUnique({
    where: { slug: "pro" },
  });
  const gateway = await prisma.paymentGateway.findFirst({
    where: { isActive: true },
  });

  if (affiliateTeacher?.referralCode && freePlan && starterPlan && proPlan && gateway) {
    const refPassword = await bcrypt.hash("guru123456", 12);
    const now = new Date();
    const activeExpiry = new Date();
    activeExpiry.setMonth(activeExpiry.getMonth() + 1);
    const expiredAt = new Date();
    expiredAt.setMonth(expiredAt.getMonth() - 1);

    const referralSeeds = [
      {
        email: "budi.pending@guru.demo",
        name: "Pak Budi Santoso",
        planId: freePlan.id,
        planExpiresAt: null as Date | null,
        paid: false,
      },
      {
        email: "ani.pending@guru.demo",
        name: "Bu Ani Wulandari",
        planId: freePlan.id,
        planExpiresAt: null,
        paid: false,
      },
      {
        email: "dewi.aktif@guru.demo",
        name: "Bu Dewi Lestari",
        planId: proPlan.id,
        planExpiresAt: activeExpiry,
        paid: true,
        amount: proPlan.priceMonthly,
      },
      {
        email: "rizal.aktif@guru.demo",
        name: "Pak Rizal Mahendra",
        planId: starterPlan.id,
        planExpiresAt: activeExpiry,
        paid: true,
        amount: starterPlan.priceMonthly,
      },
      {
        email: "fitri.nonaktif@guru.demo",
        name: "Bu Fitri Anggraini",
        planId: freePlan.id,
        planExpiresAt: expiredAt,
        paid: true,
        amount: starterPlan.priceMonthly,
      },
      {
        email: "agus.nonaktif@guru.demo",
        name: "Pak Agus Pratama",
        planId: freePlan.id,
        planExpiresAt: expiredAt,
        paid: true,
        amount: proPlan.priceMonthly,
      },
    ];

    for (const seed of referralSeeds) {
      const referred = await prisma.user.upsert({
        where: { email: seed.email },
        create: {
          email: seed.email,
          name: seed.name,
          passwordHash: refPassword,
          role: UserRole.TEACHER,
          schoolId: demoSchool.id,
          creditsRemaining: 10,
          planId: seed.planId,
          planExpiresAt: seed.planExpiresAt,
          referredById: affiliateTeacher.id,
        },
        update: {
          planId: seed.planId,
          planExpiresAt: seed.planExpiresAt,
          referredById: affiliateTeacher.id,
        },
      });

      await prisma.affiliateReferral.upsert({
        where: { referredUserId: referred.id },
        create: {
          affiliateId: affiliateTeacher.id,
          referredUserId: referred.id,
          referralCode: affiliateTeacher.referralCode,
        },
        update: {},
      });

      if (seed.paid && seed.amount) {
        const existingTx = await prisma.transaction.findFirst({
          where: {
            userId: referred.id,
            status: "PAID",
            gatewayRef: `seed-ref-${seed.email}`,
          },
        });
        if (!existingTx) {
          await prisma.transaction.create({
            data: {
              userId: referred.id,
              planId: seed.planId !== freePlan.id ? seed.planId : starterPlan.id,
              gatewayId: gateway.id,
              gatewayRef: `seed-ref-${seed.email}`,
              amount: seed.amount,
              status: "PAID",
              paidAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
              paymentMethod: "seed",
            },
          });
        }
      }
    }
  }

  await prisma.platformSetting.upsert({
    where: { key: REWARD_CONFIG_KEY },
    create: { key: REWARD_CONFIG_KEY, value: DEFAULT_REWARD_CONFIG as object },
    update: {},
  });

  await prisma.platformSetting.upsert({
    where: { key: REWARD_AD_CONFIG_KEY },
    create: {
      key: REWARD_AD_CONFIG_KEY,
      value: DEFAULT_REWARD_AD_CONFIG as object,
    },
    update: {},
  });

  const rewardMissions = [
    {
      slug: "daily-login",
      title: "Check-in Harian",
      description: "Buka aplikasi dan klaim kredit gratis setiap hari.",
      creditReward: 1,
      missionType: "DAILY" as const,
      maxPerDay: 1,
      actionUrl: null,
      icon: "login",
      sortOrder: 0,
    },
    {
      slug: "complete-profile",
      title: "Lengkapi Profil Guru",
      description:
        "Isi identitas, sekolah, mata pelajaran, periode, dan kurikulum.",
      creditReward: 5,
      missionType: "ONE_TIME" as const,
      maxPerDay: 1,
      actionUrl: "/dashboard/profil",
      icon: "user",
      sortOrder: 1,
    },
    {
      slug: "first-document",
      title: "Generate Dokumen Pertama",
      description: "Buat RPP, modul ajar, atau dokumen lain lewat generator.",
      creditReward: 3,
      missionType: "ONE_TIME" as const,
      maxPerDay: 1,
      actionUrl: "/dashboard/tools",
      icon: "sparkles",
      sortOrder: 2,
    },
    {
      slug: "share-affiliate",
      title: "Bagikan Link Afiliasi",
      description:
        "Ajak minimal 1 guru mendaftar lewat link afiliasi Anda untuk membuka klaim reward.",
      creditReward: 2,
      missionType: "DAILY" as const,
      maxPerDay: 1,
      actionUrl: "/dashboard/afiliasi",
      icon: "handshake",
      sortOrder: 3,
    },
    {
      slug: "watch-ad",
      title: "Tonton Iklan Reward",
      description: "Tonton iklan singkat untuk mendapatkan kredit tambahan.",
      creditReward: 1,
      missionType: "DAILY" as const,
      maxPerDay: 5,
      actionUrl: null,
      icon: "video",
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const mission of rewardMissions) {
    const { isActive, ...data } = mission;
    await prisma.rewardMission.upsert({
      where: { slug: mission.slug },
      create: {
        ...data,
        isActive: isActive ?? true,
      },
      update: {
        title: data.title,
        description: data.description,
        creditReward: data.creditReward,
        actionUrl: data.actionUrl,
        icon: data.icon,
        sortOrder: data.sortOrder,
        ...(mission.slug === "watch-ad" ? { isActive: true } : {}),
      },
    });
  }

  const jawaBarat = await prisma.province.upsert({
    where: { name: "Jawa Barat" },
    create: { name: "Jawa Barat", code: "32" },
    update: { code: "32" },
  });
  const kotaBandung = await prisma.regency.upsert({
    where: { provinceId_name: { provinceId: jawaBarat.id, name: "Bandung" } },
    create: {
      provinceId: jawaBarat.id,
      name: "Bandung",
      code: "32.73",
      type: "Kota",
    },
    update: { code: "32.73", type: "Kota" },
  });
  const jawaTimur = await prisma.province.upsert({
    where: { name: "Jawa Timur" },
    create: { name: "Jawa Timur", code: "35" },
    update: { code: "35" },
  });
  const kotaSurabaya = await prisma.regency.upsert({
    where: { provinceId_name: { provinceId: jawaTimur.id, name: "Surabaya" } },
    create: {
      provinceId: jawaTimur.id,
      name: "Surabaya",
      code: "35.78",
      type: "Kota",
    },
    update: { code: "35.78", type: "Kota" },
  });
  const kalimantanSelatan = await prisma.province.upsert({
    where: { name: "Kalimantan Selatan" },
    create: { name: "Kalimantan Selatan", code: "63" },
    update: { code: "63" },
  });
  const kalselRegencies = [
    { code: "63.01", name: "Tanah Laut", type: "Kabupaten" },
    { code: "63.02", name: "Kotabaru", type: "Kabupaten" },
    { code: "63.03", name: "Banjar", type: "Kabupaten" },
    { code: "63.04", name: "Barito Kuala", type: "Kabupaten" },
    { code: "63.05", name: "Tapin", type: "Kabupaten" },
    { code: "63.06", name: "Hulu Sungai Selatan", type: "Kabupaten" },
    { code: "63.07", name: "Hulu Sungai Tengah", type: "Kabupaten" },
    { code: "63.08", name: "Hulu Sungai Utara", type: "Kabupaten" },
    { code: "63.09", name: "Tabalong", type: "Kabupaten" },
    { code: "63.10", name: "Tanah Bumbu", type: "Kabupaten" },
    { code: "63.11", name: "Balangan", type: "Kabupaten" },
    { code: "63.71", name: "Banjarmasin", type: "Kota" },
    { code: "63.72", name: "Banjarbaru", type: "Kota" },
  ];
  for (const regency of kalselRegencies) {
    await prisma.regency.upsert({
      where: {
        provinceId_name: {
          provinceId: kalimantanSelatan.id,
          name: regency.name,
        },
      },
      create: {
        provinceId: kalimantanSelatan.id,
        name: regency.name,
        code: regency.code,
        type: regency.type,
      },
      update: {
        code: regency.code,
        type: regency.type,
      },
    });
  }

  const schoolBandung = await prisma.school.upsert({
    where: { npsn: "20200202" },
    create: {
      name: "SMP Negeri 2 Bandung",
      npsn: "20200202",
      level: "SMP/MTs",
      city: "Bandung",
      province: "Jawa Barat",
      regencyId: kotaBandung.id,
    },
    update: {
      city: "Bandung",
      province: "Jawa Barat",
      regencyId: kotaBandung.id,
      level: "SMP/MTs",
    },
  });

  const schoolSurabaya = await prisma.school.upsert({
    where: { npsn: "20300303" },
    create: {
      name: "SMP Negeri 5 Surabaya",
      npsn: "20300303",
      level: "SMP/MTs",
      city: "Surabaya",
      province: "Jawa Timur",
      regencyId: kotaSurabaya.id,
    },
    update: {
      city: "Surabaya",
      province: "Jawa Timur",
      regencyId: kotaSurabaya.id,
      level: "SMP/MTs",
    },
  });

  const proPlanForMembers = await prisma.subscriptionPlan.findUnique({
    where: { slug: "pro" },
  });
  const starterPlanForMembers = await prisma.subscriptionPlan.findUnique({
    where: { slug: "starter" },
  });

  const memberSeeds = [
    {
      email: "rina.ipa@guru.demo",
      name: "Bu Rina Melati",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Rina&backgroundColor=ffdfbf",
      schoolId: demoSchool.id,
      sekolah: "SMP Negeri 1 Jakarta",
      kota: "Jakarta",
      jenjang: "smp",
      mapel: "Ilmu Pengetahuan Alam",
      classes: ["7A", "8B"],
      planId: proPlanForMembers?.id,
    },
    {
      email: "joko.bindo@guru.demo",
      name: "Pak Joko Widodo",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Joko&backgroundColor=c0aede",
      schoolId: demoSchool.id,
      sekolah: "SMP Negeri 1 Jakarta",
      kota: "Jakarta",
      jenjang: "smp",
      mapel: "Bahasa Indonesia",
      classes: ["9A", "9B"],
      planId: starterPlanForMembers?.id,
    },
    {
      email: "sari.inggris@guru.demo",
      name: "Bu Sari Dewi",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Sari&backgroundColor=ffd5dc",
      schoolId: schoolBandung.id,
      sekolah: "SMP Negeri 2 Bandung",
      kota: "Bandung",
      jenjang: "smp",
      mapel: "Bahasa Inggris",
      classes: ["8A", "8C"],
      planId: freePlan?.id,
    },
    {
      email: "bambang.ipa@guru.demo",
      name: "Pak Bambang Sutrisno",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Bambang&backgroundColor=d1d4f9",
      schoolId: schoolBandung.id,
      sekolah: "SMP Negeri 2 Bandung",
      kota: "Bandung",
      jenjang: "smp",
      mapel: "IPA",
      classes: ["7B", "7C"],
      planId: freePlan?.id,
    },
    {
      email: "lina.seni@guru.demo",
      name: "Bu Lina Kartika",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Lina&backgroundColor=b6e3f4",
      schoolId: schoolSurabaya.id,
      sekolah: "SMP Negeri 5 Surabaya",
      kota: "Surabaya",
      jenjang: "smp",
      mapel: "Seni Budaya",
      classes: ["8B", "9C"],
      planId: starterPlanForMembers?.id,
    },
    {
      email: "eko.pjok@guru.demo",
      name: "Pak Eko Prasetyo",
      avatarUrl:
        "https://api.dicebear.com/7.x/avataaars/svg?seed=Eko&backgroundColor=c1f4c5",
      schoolId: schoolSurabaya.id,
      sekolah: "SMP Negeri 5 Surabaya",
      kota: "Surabaya",
      jenjang: "smp",
      mapel: "PJOK",
      classes: ["7A", "8A", "9A"],
      planId: freePlan?.id,
    },
  ];

  for (const seed of memberSeeds) {
    const { classes, sekolah, kota, jenjang, mapel, ...userData } = seed;
    const teacher = await prisma.user.upsert({
      where: { email: seed.email },
      create: {
        ...userData,
        passwordHash: teacherPassword,
        role: UserRole.TEACHER,
        creditsRemaining: 20,
        profileDefaults: {
          namaGuru: seed.name,
          sekolah,
          kota,
          jenjang,
          mapel,
          tahunAjaran: "2025/2026",
          semester: "Ganjil",
          kurikulum: "merdeka-dl",
          profileCompletedAt: new Date().toISOString(),
        },
      },
      update: {
        name: seed.name,
        avatarUrl: seed.avatarUrl,
        schoolId: seed.schoolId,
        planId: seed.planId,
        profileDefaults: {
          namaGuru: seed.name,
          sekolah,
          kota,
          jenjang,
          mapel,
          tahunAjaran: "2025/2026",
          semester: "Ganjil",
          kurikulum: "merdeka-dl",
          profileCompletedAt: new Date().toISOString(),
        },
      },
    });

    for (const className of classes) {
      await prisma.classRoom.upsert({
        where: {
          teacherId_name_tahunAjaran: {
            teacherId: teacher.id,
            name: className,
            tahunAjaran: "2025/2026",
          },
        },
        create: {
          teacherId: teacher.id,
          schoolId: seed.schoolId,
          name: className,
          jenjang,
          tahunAjaran: "2025/2026",
        },
        update: { isActive: true },
      });
    }
  }

  await prisma.platformSetting.upsert({
    where: { key: "marketplace_config" },
    create: { key: "marketplace_config", value: { commissionPercent: 5 } },
    update: {},
  });

  const merchantPassword = await bcrypt.hash("merchant123456", 12);
  const merchant = await prisma.user.upsert({
    where: { email: "merchant@demo.navalogi.id" },
    create: {
      email: "merchant@demo.navalogi.id",
      name: "Toko Demo Navalogi",
      passwordHash: merchantPassword,
      role: UserRole.MERCHANT,
      creditsRemaining: 0,
      phone: "081234567890",
    },
    update: {
      name: "Toko Demo Navalogi",
      role: UserRole.MERCHANT,
      creditsRemaining: 0,
    },
  });

  const demoStore = await prisma.merchantStore.upsert({
    where: { userId: merchant.id },
    create: {
      userId: merchant.id,
      name: "Pustaka Guru Demo",
      slug: "pustaka-guru-demo",
      description: "Toko demo buku dan ATK untuk guru serta sekolah.",
      city: "Jakarta",
      address: "Jl. Pendidikan No. 1",
      flatShippingFee: 15000,
      status: "ACTIVE",
    },
    update: {
      name: "Pustaka Guru Demo",
      description: "Toko demo buku dan ATK untuk guru serta sekolah.",
      city: "Jakarta",
      address: "Jl. Pendidikan No. 1",
      flatShippingFee: 15000,
      status: "ACTIVE",
    },
  });

  const demoProducts = [
    {
      title: "Buku Fisik Matematika SMA",
      slug: "buku-fisik-matematika-sma",
      kind: "BOOK_PHYSICAL" as const,
      price: 75000,
      stock: 20,
      description: "Buku paket matematika SMA cetak, dikirim ke alamat guru atau sekolah.",
      imageFile: "buku-matematika.jpg",
      imageSrc: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Modul Digital IPA SMP",
      slug: "modul-digital-ipa-smp",
      kind: "BOOK_DIGITAL" as const,
      price: 35000,
      stock: 0,
      description: "Modul digital IPA SMP. Diunduh setelah pembayaran lunas.",
      imageFile: "modul-ipa.jpg",
      imageSrc: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Paket ATK Pulpen Gel 12 pcs",
      slug: "paket-atk-pulpen-gel",
      kind: "STATIONERY" as const,
      price: 15000,
      stock: 100,
      description: "Paket 12 pulpen gel untuk keperluan kelas dan administrasi guru.",
      imageFile: "pulpen-gel.jpg",
      imageSrc: "https://images.unsplash.com/photo-1583484963886-cfe2bff2945f?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Buku Bahasa Indonesia Kelas 5 SD",
      slug: "buku-bahasa-indonesia-kelas-5",
      kind: "BOOK_PHYSICAL" as const,
      price: 52000,
      stock: 35,
      description: "Buku teks Bahasa Indonesia kelas 5, lengkap dengan latihan dan contoh teks.",
      imageFile: "buku-bindo.jpg",
      imageSrc: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Kamus Bahasa Inggris Bergambar",
      slug: "kamus-bahasa-inggris-bergambar",
      kind: "BOOK_PHYSICAL" as const,
      price: 68000,
      stock: 18,
      description: "Kamus bergambar untuk siswa SD–SMP, cetak hardcover.",
      imageFile: "kamus-inggris.jpg",
      imageSrc: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Atlas Indonesia & Dunia",
      slug: "atlas-indonesia-dunia",
      kind: "BOOK_PHYSICAL" as const,
      price: 89000,
      stock: 12,
      description: "Atlas berwarna untuk pelajaran IPS dan geografi, ukuran A4.",
      imageFile: "atlas.jpg",
      imageSrc: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Buku Cerita Anak Seri Karakter",
      slug: "buku-cerita-anak-karakter",
      kind: "BOOK_PHYSICAL" as const,
      price: 42000,
      stock: 40,
      description: "Kumpulan cerita pendek untuk menumbuhkan karakter siswa.",
      imageFile: "buku-cerita.jpg",
      imageSrc: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Buku Latihan Matematika SD",
      slug: "buku-latihan-matematika-sd",
      kind: "BOOK_PHYSICAL" as const,
      price: 38000,
      stock: 50,
      description: "Lembar latihan soal matematika SD, siap pakai di kelas.",
      imageFile: "latihan-mtk.jpg",
      imageSrc: "https://images.unsplash.com/photo-1596495577886-d920f1fb7238?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Modul Digital RPP Kurikulum Merdeka",
      slug: "modul-digital-rpp-merdeka",
      kind: "BOOK_DIGITAL" as const,
      price: 45000,
      stock: 0,
      description: "Paket RPP digital Kurikulum Merdeka, diunduh setelah pembayaran lunas.",
      imageFile: "modul-rpp.jpg",
      imageSrc: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "E-Book Bank Soal Asesmen",
      slug: "ebook-bank-soal-asesmen",
      kind: "BOOK_DIGITAL" as const,
      price: 55000,
      stock: 0,
      description: "Bank soal digital untuk asesmen formatif dan sumatif.",
      imageFile: "ebook-soal.jpg",
      imageSrc: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Buku Digital Literasi Membaca",
      slug: "buku-digital-literasi-membaca",
      kind: "BOOK_DIGITAL" as const,
      price: 29000,
      stock: 0,
      description: "Kumpulan teks literasi digital untuk kegiatan membaca 15 menit.",
      imageFile: "literasi.jpg",
      imageSrc: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Paket Spidol Whiteboard 8 Warna",
      slug: "paket-spidol-whiteboard",
      kind: "STATIONERY" as const,
      price: 32000,
      stock: 60,
      description: "Spidol papan tulis 8 warna, tinta mudah dihapus.",
      imageFile: "spidol.jpg",
      imageSrc: "https://images.unsplash.com/photo-1568205612837-017257d2310a?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Pensil Warna 24 Warna",
      slug: "pensil-warna-24",
      kind: "STATIONERY" as const,
      price: 28000,
      stock: 80,
      description: "Set pensil warna 24 untuk pelajaran seni dan LKPD.",
      imageFile: "pensil-warna.jpg",
      imageSrc: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Buku Tulis Bergaris Isi 10",
      slug: "buku-tulis-bergaris-isi-10",
      kind: "STATIONERY" as const,
      price: 22000,
      stock: 120,
      description: "Paket 10 buku tulis bergaris 38 lembar untuk siswa.",
      imageFile: "buku-tulis.jpg",
      imageSrc: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Binder Map Plastik A4",
      slug: "binder-map-plastik-a4",
      kind: "STATIONERY" as const,
      price: 18000,
      stock: 70,
      description: "Map binder A4 untuk arsip tugas dan dokumen kelas.",
      imageFile: "binder.jpg",
      imageSrc: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Sticky Notes Warna-warni",
      slug: "sticky-notes-warna-warni",
      kind: "STATIONERY" as const,
      price: 12000,
      stock: 150,
      description: "Set sticky notes 5 warna untuk catatan cepat di meja guru.",
      imageFile: "sticky-notes.jpg",
      imageSrc: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Set Penggaris Geometri",
      slug: "set-penggaris-geometri",
      kind: "STATIONERY" as const,
      price: 14000,
      stock: 90,
      description: "Penggaris, jangka, dan busur derajat untuk pelajaran matematika.",
      imageFile: "penggaris.jpg",
      imageSrc: "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Kalkulator Scientific Guru",
      slug: "kalkulator-scientific-guru",
      kind: "STATIONERY" as const,
      price: 95000,
      stock: 25,
      description: "Kalkulator scientific untuk guru matematika dan IPA.",
      imageFile: "kalkulator.jpg",
      imageSrc: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Tempat Pensil Kanvas",
      slug: "tempat-pensil-kanvas",
      kind: "STATIONERY" as const,
      price: 19000,
      stock: 45,
      description: "Pouch kanvas untuk pulpen, pensil, dan spidol.",
      imageFile: "tempat-pensil.jpg",
      imageSrc: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&h=700&q=80",
    },
    {
      title: "Kertas HVS A4 70gsm 1 Rim",
      slug: "kertas-hvs-a4-1-rim",
      kind: "STATIONERY" as const,
      price: 48000,
      stock: 30,
      description: "Kertas HVS A4 70gsm isi 500 lembar untuk fotokopi dan LKPD.",
      imageFile: "kertas-hvs.jpg",
      imageSrc: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=900&h=700&q=80",
    },
  ];

  const demoImageDir = path.join(process.cwd(), "public", "market-demo");
  await mkdir(demoImageDir, { recursive: true });

  async function localDemoImage(fileName: string, sourceUrl: string, title: string) {
    const dest = path.join(demoImageDir, fileName);
    try {
      await access(dest);
      return `/market-demo/${fileName}`;
    } catch {
      try {
        const res = await fetch(sourceUrl, { headers: { "User-Agent": "NavalogiDemoSeed/1.0" } });
        if (!res.ok) throw new Error(String(res.status));
        await writeFile(dest, Buffer.from(await res.arrayBuffer()));
        return `/market-demo/${fileName}`;
      } catch {
        const svgName = fileName.replace(/\.[a-z]+$/i, ".svg");
        const svgDest = path.join(demoImageDir, svgName);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
  <rect width="900" height="700" fill="#ecfdf5"/>
  <rect x="80" y="80" width="740" height="540" rx="28" fill="#ffffff" stroke="#a7f3d0" stroke-width="4"/>
  <text x="450" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#047857">${title.replace(/[<>&]/g, "")}</text>
</svg>`;
        await writeFile(svgDest, svg, "utf8");
        return `/market-demo/${svgName}`;
      }
    }
  }

  for (const product of demoProducts) {
    const imageUrl = await localDemoImage(product.imageFile, product.imageSrc, product.title);
    await prisma.marketplaceProduct.upsert({
      where: { storeId_slug: { storeId: demoStore.id, slug: product.slug } },
      create: {
        storeId: demoStore.id,
        title: product.title,
        slug: product.slug,
        kind: product.kind,
        price: product.price,
        stock: product.stock,
        description: product.description,
        imageUrl,
        status: "PUBLISHED",
      },
      update: {
        title: product.title,
        kind: product.kind,
        price: product.price,
        stock: product.stock,
        description: product.description,
        imageUrl,
        status: "PUBLISHED",
      },
    });
  }

  console.log("Seed selesai!");
  console.log("Super Admin: admin@guruspace.id / admin123456");
  console.log("Demo Guru:   guru@demo.sch.id / guru123456");
  console.log("Merchant:    merchant@demo.navalogi.id / merchant123456");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
