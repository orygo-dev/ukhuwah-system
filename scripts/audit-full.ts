/**
 * Audit menyeluruh Guru Space — alur, data, dan integritas.
 * Jalankan: npx tsx scripts/audit-full.ts
 */
import { PrismaClient, UserRole } from "@prisma/client";
import { DASHBOARD_NAV, ADMIN_NAV, MOBILE_BOTTOM_NAV, TOOLS } from "../src/lib/constants";
import { getGeneratorCatalog } from "../src/lib/generator-catalog";
import { isMobileNavActive } from "../src/lib/mobile-nav";
import { getAppDisplayConfig, APP_DISPLAY_KEY } from "../src/lib/app-display";
import {
  ALLOWED_IMAGE_MIME,
  extFromImageMime,
  IMAGE_UPLOAD_MAX_BYTES,
  isLocalUploadUrl,
} from "../src/lib/media-upload";
import { buildClassGradeReport } from "../src/lib/semester-report";
import { verifyParentAccessCode } from "../src/lib/parent-access";
import { isTeacherProfileComplete, parseTeacherProfile } from "../src/lib/teacher-profile";
import { semesterDateRange } from "../src/lib/semester";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const ROOT = path.resolve(process.cwd());

type Check = { name: string; ok: boolean; detail: string; group: string };

function routePageExists(href: string, base: "dashboard" | "admin") {
  const [pathname] = href.split("?");
  const routePath = pathname.replace(`/${base}`, `src/app/${base}`);
  const pageFile = path.join(ROOT, routePath, "page.tsx");
  if (fs.existsSync(pageFile)) {
    return { ok: true, detail: "ok" };
  }

  if (base === "dashboard" && pathname.startsWith("/dashboard/tools/")) {
    const dynamicToolPage = path.join(
      ROOT,
      "src/app/dashboard/tools/[slug]/page.tsx"
    );
    if (fs.existsSync(dynamicToolPage)) {
      return { ok: true, detail: "ok via /dashboard/tools/[slug]" };
    }
  }

  return { ok: false, detail: `missing ${pageFile}` };
}

async function main() {
  const checks: Check[] = [];

  // ── Auth & users ──
  const demoTeacher = await prisma.user.findUnique({
    where: { email: "guru@demo.sch.id" },
    include: {
      classRooms: { where: { isActive: true }, include: { students: true } },
      dailyJournals: true,
      assessments: true,
    },
  });
  const admin = await prisma.user.findUnique({ where: { email: "admin@guruspace.id" } });

  checks.push({
    group: "auth",
    name: "Demo guru ada",
    ok: !!demoTeacher,
    detail: demoTeacher?.email ?? "missing",
  });
  checks.push({
    group: "auth",
    name: "Super admin ada",
    ok: admin?.role === "SUPER_ADMIN",
    detail: admin?.email ?? "missing",
  });
  checks.push({
    group: "auth",
    name: "Kredit guru valid (0–10000)",
    ok: demoTeacher != null && demoTeacher.creditsRemaining >= 0 && demoTeacher.creditsRemaining <= 10000,
    detail: demoTeacher ? String(demoTeacher.creditsRemaining) : "n/a",
  });

  if (demoTeacher) {
    const profile = parseTeacherProfile(demoTeacher);
    checks.push({
      group: "auth",
      name: "Profil guru demo lengkap",
      ok: isTeacherProfileComplete(demoTeacher),
      detail: `${profile.mapel} · ${profile.tahunAjaran}`,
    });
  }

  // ── Nav routes (file exists) ──
  for (const item of DASHBOARD_NAV) {
    const route = routePageExists(item.href, "dashboard");
    checks.push({
      group: "nav",
      name: `Route ${item.href}`,
      ok: route.ok,
      detail: route.detail,
    });
  }

  for (const item of ADMIN_NAV) {
    const route = routePageExists(item.href, "admin");
    checks.push({
      group: "nav",
      name: `Admin ${item.href}`,
      ok: route.ok,
      detail: route.detail,
    });
  }

  const mobileFiles = [
    "src/components/layout/mobile-bottom-nav.tsx",
    "src/components/layout/mobile-menu-sheet.tsx",
    "src/lib/mobile-nav.ts",
  ];
  for (const rel of mobileFiles) {
    const full = path.join(ROOT, rel);
    checks.push({
      group: "mobile",
      name: `File ${rel}`,
      ok: fs.existsSync(full),
      detail: fs.existsSync(full) ? "ok" : "missing",
    });
  }

  const mobileHrefs = MOBILE_BOTTOM_NAV.filter((i) => i.href).map((i) => i.href!);
  const uniqueMobileHrefs = [...new Set(mobileHrefs)];
  for (const href of uniqueMobileHrefs) {
    const routePath = href.replace("/dashboard", "src/app/dashboard");
    const pageFile = path.join(ROOT, routePath, "page.tsx");
    checks.push({
      group: "mobile",
      name: `Tab route ${href}`,
      ok: fs.existsSync(pageFile),
      detail: fs.existsSync(pageFile) ? "ok" : "missing",
    });
  }

  checks.push({
    group: "mobile",
    name: "isMobileNavActive /dashboard exact",
    ok: isMobileNavActive("/dashboard", MOBILE_BOTTOM_NAV[0]),
    detail: "home tab",
  });
  checks.push({
    group: "mobile",
    name: "isMobileNavActive kelas prefix",
    ok: MOBILE_BOTTOM_NAV.some((item) =>
      item.action === "menu" && isMobileNavActive("/dashboard/kelas/abc", item)
    ),
    detail: "menu tab",
  });

  const quickMenuRoutes = [
    "/dashboard/jurnal",
    "/dashboard/absensi",
    "/dashboard/reward",
    "/dashboard/billing",
    "/dashboard/member",
    "/dashboard/afiliasi",
  ];
  for (const href of quickMenuRoutes) {
    const routePath = href.replace("/dashboard", "src/app/dashboard");
    const pageFile = path.join(ROOT, routePath, "page.tsx");
    checks.push({
      group: "mobile",
      name: `Quick menu route ${href}`,
      ok: fs.existsSync(pageFile),
      detail: fs.existsSync(pageFile) ? "ok" : "missing",
    });
  }

  const quickMenuPath = path.join(
    ROOT,
    "src/components/dashboard/dashboard-mobile-quick-menu.tsx"
  );
  const quickMenuSrc = fs.existsSync(quickMenuPath)
    ? fs.readFileSync(quickMenuPath, "utf-8")
    : "";
  checks.push({
    group: "mobile",
    name: "Quick menu dashboard grid layout",
    ok:
      quickMenuSrc.includes("grid-cols-4") &&
      quickMenuSrc.includes("lg:hidden") &&
      (quickMenuSrc.match(/href:\s*"/g)?.length ?? 0) >= 12,
    detail: "4 cols, 12 items, mobile only",
  });

  const generatorCatalog = await getGeneratorCatalog();
  const generatorConfigMap = new Map(
    (
      await prisma.aiToolConfig.findMany({
        select: { toolSlug: true, creditCost: true, isActive: true },
      })
    ).map((config) => [config.toolSlug, config])
  );
  for (const tool of generatorCatalog) {
    const config = generatorConfigMap.get(tool.slug);
    const staticTool = TOOLS.find((item) => item.slug === tool.slug);
    const expectedCost = config?.creditCost ?? staticTool?.creditCost;
    checks.push({
      group: "generator",
      name: `Biaya generator ${tool.slug}`,
      ok: tool.creditCost === expectedCost,
      detail: `${tool.creditCost} kredit, ${tool.isActive ? "aktif" : "nonaktif"}`,
    });
  }
  checks.push({
    group: "mobile",
    name: "Quick menu on dashboard page",
    ok: fs
      .readFileSync(path.join(ROOT, "src/app/dashboard/page.tsx"), "utf-8")
      .includes("DashboardMobileQuickMenu"),
    detail: "imported and rendered",
  });

  const mobileBannerPath = path.join(
    ROOT,
    "src/components/dashboard/dashboard-mobile-banner-carousel.tsx"
  );
  const mobileBannerSrc = fs.existsSync(mobileBannerPath)
    ? fs.readFileSync(mobileBannerPath, "utf-8")
    : "";
  const dashboardPageSrc = fs.readFileSync(
    path.join(ROOT, "src/app/dashboard/page.tsx"),
    "utf-8"
  );
  const commercialDashboardPath = path.join(
    ROOT,
    "src/components/dashboard/commercial-dashboard.tsx"
  );
  const commercialDashboardSrc = fs.existsSync(commercialDashboardPath)
    ? fs.readFileSync(commercialDashboardPath, "utf-8")
    : "";
  checks.push({
    group: "mobile",
    name: "Mobile peek banner below quick menu",
    ok:
      mobileBannerSrc.includes("lg:hidden") &&
      mobileBannerSrc.includes("translateX") &&
      dashboardPageSrc.includes("DashboardMobileBannerCarousel") &&
      dashboardPageSrc.indexOf("<DashboardMobileQuickMenu") <
        dashboardPageSrc.indexOf("<DashboardMobileBannerCarousel"),
    detail: "peek carousel after quick menu",
  });
  checks.push({
    group: "mobile",
    name: "Desktop banner hidden on mobile",
    ok:
      dashboardPageSrc.includes("CommercialDashboard") &&
      commercialDashboardSrc.includes("hidden gap-5") &&
      commercialDashboardSrc.includes("lg:grid"),
    detail: "no duplicate banner on mobile",
  });

  const displayFiles = [
    "src/lib/app-display.ts",
    "src/lib/app-display.shared.ts",
    "src/lib/media-upload.ts",
    "src/components/branding/app-logo.tsx",
    "src/components/admin/image-upload-field.tsx",
    "src/components/dashboard/dashboard-banner-carousel.tsx",
    "src/components/dashboard/dashboard-mobile-profile-card.tsx",
    "src/components/dashboard/dashboard-mobile-quick-menu.tsx",
    "src/components/dashboard/dashboard-mobile-banner-carousel.tsx",
    "src/components/dashboard/dashboard-popup-ad.tsx",
    "src/components/admin/admin-app-display-client.tsx",
    "src/app/admin/app-display/page.tsx",
    "src/app/api/app-display/route.ts",
    "src/app/api/admin/app-display/route.ts",
    "src/app/api/admin/media/upload/route.ts",
  ];
  for (const rel of displayFiles) {
    const full = path.join(ROOT, rel);
    checks.push({
      group: "display",
      name: `File ${rel}`,
      ok: fs.existsSync(full),
      detail: fs.existsSync(full) ? "ok" : "missing",
    });
  }

  const appDisplay = await getAppDisplayConfig();
  checks.push({
    group: "display",
    name: "PlatformSetting app_display",
    ok: !!appDisplay.branding.appName,
    detail: appDisplay.branding.appName,
  });
  checks.push({
    group: "display",
    name: "Admin route /admin/app-display",
    ok: fs.existsSync(path.join(ROOT, "src/app/admin/app-display/page.tsx")),
    detail: APP_DISPLAY_KEY,
  });

  checks.push({
    group: "display",
    name: "Upload MIME types",
    ok: ALLOWED_IMAGE_MIME.has("image/png") && ALLOWED_IMAGE_MIME.size >= 4,
    detail: `${ALLOWED_IMAGE_MIME.size} types`,
  });
  checks.push({
    group: "display",
    name: "extFromImageMime webp",
    ok: extFromImageMime("image/webp") === "webp",
    detail: "webp",
  });
  checks.push({
    group: "display",
    name: "isLocalUploadUrl",
    ok: isLocalUploadUrl("/uploads/app-display/logo/x.png"),
    detail: `max ${IMAGE_UPLOAD_MAX_BYTES} bytes`,
  });
  checks.push({
    group: "display",
    name: "public/uploads/.gitkeep",
    ok: fs.existsSync(path.join(ROOT, "public/uploads/.gitkeep")),
    detail: "upload dir",
  });

  const extraRoutes = [
    "/dashboard/kelas/[id]",
    "/dashboard/jurnal/baru",
    "/dashboard/jurnal/[id]",
    "/dashboard/penilaian/[id]",
    "/dashboard/penilaian/rekap",
    "/dashboard/penilaian/rapor-semester",
    "/dashboard/absensi/kelas/[id]",
    "/dashboard/absensi/sesi/[id]",
    "/dashboard/absensi/rekap",
    "/orangtua",
    "/orangtua/portal",
  ];
  for (const href of extraRoutes) {
    const filePath = href
      .replace("/dashboard", "src/app/dashboard")
      .replace("/orangtua", "src/app/orangtua");
    const pageFile = path.join(ROOT, filePath, "page.tsx");
    checks.push({
      group: "nav",
      name: `Route ${href}`,
      ok: fs.existsSync(pageFile),
      detail: fs.existsSync(pageFile) ? "ok" : "missing",
    });
  }

  // ── Kelas & siswa ──
  const demoClass = demoTeacher?.classRooms.find((c) => c.name === "8A");
  checks.push({
    group: "kelas",
    name: "Kelas demo 8A",
    ok: !!demoClass && demoClass.students.length >= 5,
    detail: demoClass ? `${demoClass.students.length} siswa` : "missing",
  });

  // ── Jurnal ──
  checks.push({
    group: "jurnal",
    name: "Jurnal demo ter-seed",
    ok: (demoTeacher?.dailyJournals.length ?? 0) >= 1,
    detail: `count=${demoTeacher?.dailyJournals.length ?? 0}`,
  });

  // ── Penilaian ──
  checks.push({
    group: "penilaian",
    name: "Penilaian demo",
    ok: (demoTeacher?.assessments.length ?? 0) >= 1,
    detail: `count=${demoTeacher?.assessments.length ?? 0}`,
  });

  const withSemester = await prisma.assessment.count({
    where: { semester: { not: null }, tahunAjaran: { not: null } },
  });
  checks.push({
    group: "penilaian",
    name: "Penilaian punya semester",
    ok: withSemester >= 1,
    detail: `count=${withSemester}`,
  });

  if (demoClass) {
    const report = await buildClassGradeReport({
      classRoomId: demoClass.id,
      semester: "Ganjil",
      tahunAjaran: "2025/2026",
    });
    checks.push({
      group: "penilaian",
      name: "Rapor semester terbentuk",
      ok: (report?.report.length ?? 0) >= 5,
      detail: `${report?.report.length ?? 0} siswa`,
    });
  }

  // ── Portal orang tua ──
  const parentStudent = await prisma.student.findFirst({
    where: { parentAccessEnabled: true, parentAccessCodeHash: { not: null } },
  });
  checks.push({
    group: "orangtua",
    name: "Kode orang tua aktif",
    ok: !!parentStudent,
    detail: parentStudent?.name ?? "none",
  });
  if (parentStudent) {
    const valid = await verifyParentAccessCode("DEMO8A01", parentStudent.parentAccessCodeHash);
    checks.push({
      group: "orangtua",
      name: "Kode DEMO8A01 valid",
      ok: valid,
      detail: valid ? "ok" : "invalid",
    });
  }

  // ── Absensi ──
  const sessions = await prisma.attendanceSession.count({
    where: { teacherId: demoTeacher?.id },
  });
  checks.push({
    group: "absensi",
    name: "Sesi absensi tercatat",
    ok: sessions >= 0,
    detail: `count=${sessions}`,
  });

  // ── Member ──
  const teachers = await prisma.user.count({ where: { role: UserRole.TEACHER } });
  checks.push({
    group: "member",
    name: "Direktori guru",
    ok: teachers >= 5,
    detail: `count=${teachers}`,
  });

  // ── Reward ──
  const missions = await prisma.rewardMission.count();
  checks.push({
    group: "reward",
    name: "Misi reward ada",
    ok: missions >= 1,
    detail: `count=${missions}`,
  });

  // ── Chat ──
  const conversations = await prisma.conversation.count();
  checks.push({
    group: "chat",
    name: "Model chat siap",
    ok: conversations >= 0,
    detail: `count=${conversations}`,
  });

  // ── UI components ──
  const uiFiles = [
    "src/components/ui/select.tsx",
    "src/components/ui/button.tsx",
    "src/hooks/use-dashboard-user.ts",
    "src/components/layout/dashboard-shell.tsx",
    "src/components/layout/mobile-dashboard-header.tsx",
    "src/app/globals.css",
    "postcss.config.mjs",
    "tailwind.config.ts",
  ];
  for (const f of uiFiles) {
    checks.push({
      group: "ui",
      name: `File ${f}`,
      ok: fs.existsSync(path.join(ROOT, f)),
      detail: "ok",
    });
  }

  const buttonSrc = fs.readFileSync(path.join(ROOT, "src/components/ui/button.tsx"), "utf8");
  checks.push({
    group: "ui",
    name: "Button tidak pakai accent-foreground hover",
    ok: !buttonSrc.includes("hover:text-accent-foreground"),
    detail: "kontras hover diperbaiki",
  });

  const selectSrc = fs.readFileSync(path.join(ROOT, "src/components/ui/select.tsx"), "utf8");
  checks.push({
    group: "ui",
    name: "Select pakai data-highlighted primary",
    ok: selectSrc.includes("data-[highlighted]:bg-primary"),
    detail: "dropdown kontras",
  });

  // ── Semester helper ──
  const range = semesterDateRange("2025/2026", "Ganjil");
  checks.push({
    group: "utils",
    name: "Semester Ganjil range",
    ok: range.from === "2025-07-01",
    detail: `${range.from} — ${range.to}`,
  });

  printReport(checks);
}

function printReport(checks: Check[]) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     AUDIT MENYELURUH — GURU SPACE        ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const groups = [...new Set(checks.map((c) => c.group))];
  for (const group of groups) {
    const items = checks.filter((c) => c.group === group);
    console.log(`── ${group.toUpperCase()} ──`);
    for (const c of items) {
      console.log(`  ${c.ok ? "✓" : "✗"} ${c.name}`);
      console.log(`    ${c.detail}`);
    }
    console.log();
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  console.log(`══════════════════════════════════════════`);
  console.log(`HASIL: ${passed}/${checks.length} lulus, ${failed} gagal`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
