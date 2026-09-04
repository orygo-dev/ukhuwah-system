import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE = "https://referensi.data.kemendikdasmen.go.id";
const PROVINCE_CODE = "150000";
const PROVINCE_NAME = "Kalimantan Selatan";
const PROVINCE_ADMIN_CODE = "63";
const SOURCES = ["dikmen"] as const;
const DRY_RUN = process.argv.includes("--dry-run");

const KALSEL_REGENCIES = [
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

type SchoolRecord = {
  npsn: string;
  name: string;
  level: string;
  address: string | null;
  regencyName: string;
};

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeRegencyName(value: string) {
  return stripTags(value)
    .replace(/^Kab\.\s+/i, "")
    .replace(/^Kota\s+/i, "")
    .trim();
}

function absoluteUrl(href: string) {
  return href.startsWith("http") ? href : `${BASE}${href}`;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GuruSpaceSchoolImporter/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`Gagal mengambil ${url}: ${res.status}`);
  }
  return res.text();
}

function extractEducationLinks(html: string, source: (typeof SOURCES)[number], level: 2 | 3) {
  const matches = [...html.matchAll(/href="([^"]*\/pendidikan\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  return matches
    .map((match) => ({
      url: absoluteUrl(match[1]),
      label: stripTags(match[2]),
    }))
    .filter((link) => link.url.includes(`/pendidikan/${source}/`) && link.url.includes(`/${level}/`));
}

function inferLevel(name: string) {
  const upper = name.toUpperCase().replace(/\./g, "").trim();
  if (upper.startsWith("SMK")) return "SMK/MAK";
  if (upper.startsWith("SMA")) return "SMA/MA";
  return null;
}

function parseSchools(html: string, regencyName: string, districtName: string): SchoolRecord[] {
  const rows = [...html.matchAll(/<tr>\s*<td[^>]*>\s*\d+\s*<\/td>([\s\S]*?)<\/tr>/g)];
  return rows.flatMap((row) => {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
      stripTags(cell[1])
    );
    if (cells.length < 5) return [];
    const [npsn, name, street, village] = cells;
    if (!/^\d{8}$/.test(npsn)) return [];
    const level = inferLevel(name);
    if (!level) return [];
    const address = [street, village, districtName].filter(Boolean).join(", ");
    return [
      {
        npsn,
        name,
        level,
        address: address || null,
        regencyName,
      },
    ];
  });
}

async function ensureKalselRegion() {
  const province = await prisma.province.upsert({
    where: { name: PROVINCE_NAME },
    create: { name: PROVINCE_NAME, code: PROVINCE_ADMIN_CODE },
    update: { code: PROVINCE_ADMIN_CODE },
  });

  for (const regency of KALSEL_REGENCIES) {
    await prisma.regency.upsert({
      where: {
        provinceId_name: {
          provinceId: province.id,
          name: regency.name,
        },
      },
      create: {
        provinceId: province.id,
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

  return prisma.regency.findMany({
    where: { provinceId: province.id },
    select: { id: true, name: true },
  });
}

async function scrapeSchools() {
  const records = new Map<string, SchoolRecord>();

  for (const source of SOURCES) {
    const provinceUrl = `${BASE}/pendidikan/${source}/${PROVINCE_CODE}/1/jf/all/s1`;
    const provinceHtml = await fetchHtml(provinceUrl);
    const regencyLinks = extractEducationLinks(provinceHtml, source, 2);

    for (const regencyLink of regencyLinks) {
      const regencyName = normalizeRegencyName(regencyLink.label);
      const regencyHtml = await fetchHtml(regencyLink.url);
      const districtLinks = extractEducationLinks(regencyHtml, source, 3);

      for (const districtLink of districtLinks) {
        const districtName = normalizeRegencyName(districtLink.label);
        const districtHtml = await fetchHtml(districtLink.url);
        for (const school of parseSchools(districtHtml, regencyName, districtName)) {
          records.set(school.npsn, school);
        }
      }
      console.log(`${source}: ${regencyName} selesai (${records.size} sekolah terkumpul)`);
    }
  }

  return [...records.values()];
}

async function main() {
  const schools = await scrapeSchools();
  const currentSchools = await prisma.school.findMany({
    where: {
      OR: [
        { province: PROVINCE_NAME },
        { regency: { province: { name: PROVINCE_NAME } } },
      ],
    },
    select: {
      npsn: true,
      name: true,
      level: true,
      address: true,
      city: true,
    },
  });

  const officialByNpsn = new Map(schools.map((school) => [school.npsn, school]));
  const currentByNpsn = new Map(
    currentSchools.flatMap((school) => (school.npsn ? [[school.npsn, school] as const] : []))
  );
  const missing = schools.filter((school) => !currentByNpsn.has(school.npsn));
  const stale = currentSchools.filter(
    (school) => !school.npsn || !officialByNpsn.has(school.npsn)
  );
  const changed = schools.filter((school) => {
    const current = currentByNpsn.get(school.npsn);
    return (
      current &&
      (current.name !== school.name ||
        current.level !== school.level ||
        current.address !== school.address ||
        current.city !== school.regencyName)
    );
  });

  console.log(
    JSON.stringify(
      {
        source: `${BASE}/pendidikan/dikmen/${PROVINCE_CODE}/1/jf/all/s1`,
        official: schools.length,
        current: currentSchools.length,
        missing: missing.map(({ npsn, name, regencyName }) => ({ npsn, name, regencyName })),
        changed: changed.map(({ npsn, name }) => ({ npsn, name })),
        stale: stale.map(({ npsn, name }) => ({ npsn, name })),
        dryRun: DRY_RUN,
      },
      null,
      2
    )
  );

  if (DRY_RUN) return;

  const regencies = await ensureKalselRegion();
  const regencyByName = new Map(regencies.map((item) => [item.name.toLowerCase(), item.id]));

  let imported = 0;
  let skipped = 0;

  for (const school of schools) {
    const regencyId = regencyByName.get(school.regencyName.toLowerCase());
    if (!regencyId) {
      skipped += 1;
      console.warn(`Lewati ${school.npsn} ${school.name}: kab/kota tidak ditemukan ${school.regencyName}`);
      continue;
    }

    await prisma.school.upsert({
      where: { npsn: school.npsn },
      create: {
        npsn: school.npsn,
        name: school.name,
        level: school.level,
        address: school.address,
        regencyId,
        city: school.regencyName,
        province: PROVINCE_NAME,
      },
      update: {
        name: school.name,
        level: school.level,
        address: school.address,
        regencyId,
        city: school.regencyName,
        province: PROVINCE_NAME,
      },
    });
    imported += 1;
  }

  console.log(
    JSON.stringify(
      {
        province: PROVINCE_NAME,
        scraped: schools.length,
        imported,
        skipped,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
