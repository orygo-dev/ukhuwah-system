import { z } from "zod";
import {
  APP_NAME,
  DEFAULT_BRAND_LOGO_URL,
  displayAppName,
  displayLogoUrl,
} from "@/lib/constants";

/** Public links only. Never allow protocol-relative URLs, credentials or script schemes. */
export function isSafeLandingHref(value: string): boolean {
  if (!value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("#")) return /^#[a-zA-Z][\w-]*$/.test(value);
  if (value.startsWith("/")) {
    try {
      const decoded = decodeURIComponent(value);
      return (
        !decoded.startsWith("//") &&
        !/[\\\u0000-\u001f\u007f]/.test(decoded) &&
        new URL(value, "https://landing.invalid").origin ===
          "https://landing.invalid"
      );
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value);
    return (
      ["https:", "http:", "mailto:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      (url.protocol === "mailto:" || Boolean(url.hostname))
    );
  } catch {
    return false;
  }
}

export const landingHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    isSafeLandingHref,
    "Gunakan path internal, anchor, http(s), atau mailto yang valid.",
  );
const copy = z.string().trim().min(1).max(500);
const link = z.object({ label: copy.max(80), href: landingHrefSchema });
const feature = z.object({ title: copy.max(160), description: copy, link });
export const landingExperienceSchema = z.object({
  heading: copy.max(160),
  classroom: feature,
  reading: feature,
  spotlight: feature,
  ai: feature,
  app: z.object({
    title: copy.max(160),
    webDescription: copy,
    androidDescription: copy,
    androidUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => !v || (isSafeLandingHref(v) && v.startsWith("https://")),
        "Tautan Android harus berupa URL HTTPS resmi, atau kosong.",
      ),
  }),
  teacher: feature,
  school: feature,
  parent: feature,
});
export type LandingExperience = z.infer<typeof landingExperienceSchema>;

export const DEFAULT_LANDING_EXPERIENCE: LandingExperience = {
  heading: "Fitur yang menopang pendidikan Islam terpadu.",
  classroom: {
    title: "Kelola kelas dengan tertib dan terhubung.",
    description:
      "Tugas, kuis, absensi, ujian, dan penilaian dalam satu ruang kelas untuk guru dan siswa unit pendidikan Yayasan Ukhuwah.",
    link: { label: "Lihat kegiatan kelas", href: "/fitur/kelas" },
  },
  reading: {
    title: "Zona Baca untuk kebiasaan literasi.",
    description:
      "Bacaan digital yang menemani siswa menumbuhkan karakter Qur'ani dan minat baca setiap hari.",
    link: { label: "Jelajahi Zona Baca", href: "/fitur/zona-baca" },
  },
  spotlight: {
    title: "Zona Kreasi untuk karya siswa.",
    description:
      "Tampilkan karya terbaik, rayakan prestasi, dan bagikan perkembangan kelas kepada warga sekolah.",
    link: { label: "Jelajahi Zona Kreasi", href: "/fitur/spotlight" },
  },
  ai: {
    title: "Asisten penyusunan perangkat ajar.",
    description:
      "Bantu guru menyusun draf RPP, modul ajar, dan perangkat penilaian. Hasilnya tetap ditinjau guru sebelum dipakai di kelas.",
    link: { label: "Pelajari asisten guru", href: "/fitur/ai" },
  },
  app: {
    title: "Diakses lewat web dan Android.",
    webDescription:
      "Guru dan pengelola unit sekolah menjalankan administrasi serta pembelajaran lewat peramban.",
    androidDescription:
      "Siswa mengikuti kelas, tugas, dan ujian dari Android dengan akun yang disiapkan sekolah.",
    androidUrl: "",
  },
  teacher: {
    title: "Untuk Guru",
    description:
      "Kelola kelas, absensi, tugas, ujian, penilaian, jurnal mengajar, dan perangkat ajar harian.",
    link: { label: "Pelajari fitur guru", href: "/fitur" },
  },
  school: {
    title: "Untuk Sekolah",
    description:
      "Kelola guru, siswa, administrasi unit, PJJ, dan pantau kegiatan pembelajaran di sekolah naungan yayasan.",
    link: { label: "Pelajari solusi sekolah", href: "/untuk-sekolah" },
  },
  parent: {
    title: "Untuk Orang Tua",
    description:
      "Pantau kehadiran, nilai, dan perkembangan putra-putri melalui portal orang tua dengan kode akses dari sekolah.",
    link: { label: "Buka portal orang tua", href: "/orangtua" },
  },
};

export function landingHref(value: string | undefined, fallback = "#mulai") {
  return typeof value === "string" && isSafeLandingHref(value.trim())
    ? value.trim()
    : fallback;
}

export function landingBrand(branding?: {
  appName?: string;
  logoUrl?: string;
}) {
  const appName = displayAppName(branding?.appName) || APP_NAME;
  const configuredLogo = displayLogoUrl(branding?.logoUrl);
  const logoUrl =
    configuredLogo &&
    isSafeLandingHref(configuredLogo) &&
    !configuredLogo.startsWith("mailto:") &&
    !configuredLogo.startsWith("#")
      ? configuredLogo
      : DEFAULT_BRAND_LOGO_URL;
  return { appName, logoUrl };
}
