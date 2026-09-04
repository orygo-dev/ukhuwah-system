import {
  BookOpen,
  Clock,
  FileText,
  Shield,
  Sparkles,
  Zap,
  UserRound,
  GraduationCap,
  Building2,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  DEFAULT_LANDING_EXPERIENCE,
  type LandingExperience,
} from "./landing-experience";

export const LANDING_PAGE_KEY = "landing_page";

export type LandingCta = {
  label: string;
  href: string;
};

export type LandingStat = {
  value: string;
  label: string;
};

export type LandingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type LandingStep = {
  step: string;
  title: string;
  description: string;
};

export type LandingPlan = {
  name: string;
  price: number;
  period: string;
  credits: string;
  features: string[];
  cta: string;
  popular: boolean;
};

export type LandingPageConfig = {
  schemaVersion?: 2 | 3 | 4 | 5;
  experience?: LandingExperience;
  hero: {
    badge: string;
    title: string;
    titleHighlight: string;
    subtitle: string;
    primaryCta: LandingCta;
    secondaryCta: LandingCta;
    trustLine: string;
    stats: LandingStat[];
  };
  features: {
    title: string;
    subtitle: string;
    items: LandingFeature[];
  };
  steps: {
    title: string;
    items: LandingStep[];
  };
  pricing: {
    title: string;
    subtitle: string;
    plans: LandingPlan[];
  };
  cta: {
    title: string;
    subtitle: string;
    button: LandingCta;
  };
  header: {
    loginLabel: string;
    registerLabel: string;
  };
  footer: {
    description: string;
  };
};

export const LANDING_ICON_MAP: Record<string, LucideIcon> = {
  UserRound,
  GraduationCap,
  Building2,
  UsersRound,
  FileText,
  BookOpen,
  Zap,
  Shield,
  Sparkles,
  Clock,
};

export const LANDING_ICON_OPTIONS = [
  { value: "UserRound", label: "Guru" },
  { value: "GraduationCap", label: "Siswa" },
  { value: "Building2", label: "Sekolah" },
  { value: "UsersRound", label: "Orang tua" },
  { value: "FileText", label: "Dokumen" },
  { value: "BookOpen", label: "Buku" },
  { value: "Zap", label: "Petir" },
  { value: "Shield", label: "Perisai" },
  { value: "Sparkles", label: "Bintang" },
  { value: "Clock", label: "Jam" },
];

export const LEGACY_LANDING_PAGE: LandingPageConfig = {
  hero: {
    badge: "Pembelajaran Mendalam · Kurikulum Merdeka 2025",
    title: "Administrasi Guru",
    titleHighlight: "Otomatis dengan AI",
    subtitle:
      "Generate Modul Ajar, RPP, Bank Soal, LKPD, dan 20+ dokumen administrasi sekolah dalam hitungan detik. Fokus mengajar, bukan begadang mengetik.",
    primaryCta: { label: "Buat 10 Dokumen Gratis", href: "/register" },
    secondaryCta: { label: "Lihat Semua Tools", href: "/dashboard/tools" },
    trustLine:
      "✓ Daftar pakai email · ✓ Tanpa kartu kredit · ✓ Siap pakai < 1 menit",
    stats: [
      { value: "2-3 jam → 5 menit", label: "Waktu buat RPP" },
      { value: "20+", label: "AI Generator" },
      { value: "4", label: "Kategori Dokumen" },
    ],
  },
  features: {
    title: "Semua yang Guru Butuhkan",
    subtitle:
      "Bukan chatbot generik. Setiap tool punya form khusus dengan output siap pakai sesuai standar Kemendikdasmen.",
    items: [
      {
        icon: "FileText",
        title: "Modul Ajar Deep Learning",
        description:
          "Sesuai Permendikdasmen 13/2025 dengan 4 Pilar Pembelajaran Mendalam.",
      },
      {
        icon: "BookOpen",
        title: "20+ Generator Dokumen",
        description:
          "RPP, Prota, Prosem, LKPD, Bank Soal, Jurnal, Surat Dinas, dan lainnya.",
      },
      {
        icon: "Zap",
        title: "Hemat Waktu 95%",
        description:
          "RPP yang biasanya 2–3 jam, selesai dalam kurang dari 5 menit.",
      },
      {
        icon: "Shield",
        title: "Data Aman & Privat",
        description:
          "Dokumen terenkripsi. Data tidak dipakai melatih model AI.",
      },
    ],
  },
  steps: {
    title: "Mulai dalam 3 Langkah",
    items: [
      {
        step: "1",
        title: "Daftar Gratis",
        description:
          "Buat akun dengan email dalam 30 detik. Langsung dapat 10 kredit gratis.",
      },
      {
        step: "2",
        title: "Pilih Tool",
        description:
          "Modul Ajar, Bank Soal, LKPD — pilih dari 20+ generator dokumen.",
      },
      {
        step: "3",
        title: "Generate & Export",
        description:
          "Isi form, klik Generate, edit hasil, export ke PDF atau Word.",
      },
    ],
  },
  pricing: {
    title: "Harga Transparan",
    subtitle: "Mulai gratis. Upgrade kapan saja tanpa kontrak.",
    plans: [
      {
        name: "Gratis",
        price: 0,
        period: "selamanya",
        credits: "10 dokumen welcome",
        features: [
          "Akses semua generator",
          "Preview & edit hasil",
          "Export PDF & Word",
          "Hingga 3 folder dokumen",
        ],
        cta: "Mulai Gratis",
        popular: false,
      },
      {
        name: "Starter",
        price: 49000,
        period: "per bulan",
        credits: "50 generate / bulan",
        features: [
          "50 generate per bulan",
          "Export unlimited",
          "Arsip dokumen unlimited",
          "Email support",
        ],
        cta: "Pilih Starter",
        popular: false,
      },
      {
        name: "Pro",
        price: 149000,
        period: "per bulan",
        credits: "250 generate / bulan",
        features: [
          "250 generate per bulan",
          "Priority queue",
          "Default profil tersimpan",
          "Support WhatsApp",
        ],
        cta: "Pilih Pro",
        popular: true,
      },
    ],
  },
  cta: {
    title: "Hentikan Begadang Mengetik RPP",
    subtitle:
      "Bergabung dengan guru Indonesia yang sudah menghemat ratusan jam administrasi setiap semester.",
    button: { label: "Mulai Gratis Sekarang", href: "/register" },
  },
  header: {
    loginLabel: "Masuk",
    registerLabel: "Mulai Gratis",
  },
  footer: {
    description:
      "Platform AI administrasi guru untuk Indonesia. Generate RPP, Modul Ajar, Bank Soal, dan 20+ dokumen sekolah dalam hitungan detik.",
  },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeDeep<T>(base: T, patch: unknown): T {
  if (!isObject(patch)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) continue;
    const baseVal = (base as Record<string, unknown>)[key];
    const patchVal = patch[key];
    if (Array.isArray(patchVal)) {
      out[key] = patchVal;
    } else if (isObject(baseVal) && isObject(patchVal)) {
      out[key] = mergeDeep(baseVal, patchVal);
    } else if (patchVal !== undefined) {
      out[key] = patchVal;
    }
  }
  return out as T;
}

export function mergeLandingPage(
  base: LandingPageConfig,
  patch: unknown,
): LandingPageConfig {
  return mergeDeep(base, patch);
}

/** Exact previous default (v3) — used only to upgrade untouched defaults to v4. */
export const LANDING_PAGE_V3_DEFAULT: LandingPageConfig = {
  ...LEGACY_LANDING_PAGE,
  schemaVersion: 3,
  hero: {
    badge: "",
    title: "Belajar, mengajar, dan mengelola sekolah—",
    titleHighlight: "lebih terhubung.",
    subtitle:
      "Kelas, tugas, penilaian, literasi, dan administrasi dalam satu platform pendidikan.",
    primaryCta: { label: "Jelajahi Fitur", href: "/fitur" },
    secondaryCta: { label: "Lihat Aplikasi", href: "/aplikasi" },
    trustLine: "",
    stats: [],
  },
  features: {
    title: "Satu platform, banyak peran.",
    subtitle: "",
    items: [
      {
        icon: "UserRound",
        title: "Guru",
        description: "Siapkan pembelajaran dan kelola kelas.",
      },
      {
        icon: "GraduationCap",
        title: "Siswa",
        description: "Belajar, berkarya, dan berkembang.",
      },
      {
        icon: "Building2",
        title: "Sekolah",
        description: "Kelola kegiatan dan pantau pembelajaran.",
      },
      {
        icon: "UsersRound",
        title: "Orang Tua",
        description: "Ikuti perkembangan belajar anak.",
      },
    ],
  },
  steps: {
    title: "Pembelajaran yang saling terhubung.",
    items: [
      {
        step: "1",
        title: "Siapkan",
        description: "Rencanakan materi dan buat kegiatan.",
      },
      {
        step: "2",
        title: "Belajar",
        description: "Siswa mengikuti dan mengerjakan tugas.",
      },
      {
        step: "3",
        title: "Nilai",
        description: "Nilai, beri umpan balik, dan rangkum hasil.",
      },
      {
        step: "4",
        title: "Pantau",
        description: "Pantau perkembangan secara menyeluruh.",
      },
    ],
  },
  pricing: {
    ...LEGACY_LANDING_PAGE.pricing,
    title: "Pilihan untuk guru dan sekolah.",
    subtitle:
      "Harga, kuota, dan fitur mengikuti paket aktif di dashboard masing-masing.",
  },
  cta: {
    title: "Bangun pengalaman belajar yang lebih terhubung.",
    subtitle: "",
    button: { label: "Kenali {appName}", href: "/fitur" },
  },
  header: { loginLabel: "Masuk", registerLabel: "Daftar akun guru" },
  footer: { description: "Untuk guru, siswa, sekolah, dan orang tua." },
  experience: {
    heading: "Lebih dari administrasi.",
    classroom: {
      title: "Kegiatan kelas, lebih tertata.",
      description:
        "Kelola tugas, kuis, absensi, dan penilaian dalam satu ruang kelas yang rapi dan mudah digunakan.",
      link: { label: "Kenali kegiatan kelas", href: "/fitur/kelas" },
    },
    reading: {
      title: "Tumbuhkan kebiasaan membaca.",
      description: "Bacaan digital untuk menemani perjalanan belajar.",
      link: { label: "Kenali Zona Baca", href: "/fitur/zona-baca" },
    },
    spotlight: {
      title: "Ruang untuk karya dan inspirasi.",
      description: "Bagikan karya terbaik dan temukan inspirasi bersama.",
      link: { label: "Kenali Zona Kreasi", href: "/fitur/spotlight" },
    },
    ai: {
      title: "AI yang membantu guru.",
      description:
        "Bantu susun dokumen pembelajaran. Guru tetap meninjau hasilnya.",
      link: { label: "Jelajahi AI", href: "/fitur/ai" },
    },
    app: {
      title: "Terhubung melalui web dan Android.",
      webDescription:
        "Lengkapi proses mengajar dan kelola sekolah melalui browser.",
      androidDescription:
        "Akses pembelajaran dari perangkat Android dengan akun siswa yang sudah tersedia.",
      androidUrl: "",
    },
    teacher: {
      title: "Paket Guru",
      description: "Untuk kebutuhan mengajar individu.",
      link: { label: "Lihat Paket Guru", href: "/paket/guru" },
    },
    school: {
      title: "Paket Sekolah",
      description: "Untuk pengelolaan pendidikan bersama.",
      link: { label: "Lihat Solusi Sekolah", href: "/untuk-sekolah" },
    },
    parent: DEFAULT_LANDING_EXPERIENCE.parent,
  },
};

/** Exact previous default (v4) — used only to upgrade untouched defaults to v5. */
export const LANDING_PAGE_V4_DEFAULT: LandingPageConfig = {
  ...LEGACY_LANDING_PAGE,
  schemaVersion: 4,
  hero: {
    badge: "",
    title: "Kelola siswa,",
    titleHighlight: "mudahkan mengajar.",
    subtitle:
      "Platform untuk mengelola kelas, siswa, tugas, dan pembelajaran—agar guru fokus mengajar.",
    primaryCta: { label: "Daftar Gratis", href: "/register" },
    secondaryCta: { label: "Masuk", href: "/login" },
    trustLine: "Gratis dicoba · Siap pakai untuk guru dan sekolah",
    stats: [],
  },
  features: {
    title: "Untuk siapa Navalogi?",
    subtitle: "Satu platform yang menghubungkan seluruh ekosistem sekolah.",
    items: [
      {
        icon: "UserRound",
        title: "Guru",
        description: "Kelola kelas, siswa, dan administrasi mengajar.",
      },
      {
        icon: "GraduationCap",
        title: "Siswa",
        description: "Kerjakan tugas, belajar, dan berkembang.",
      },
      {
        icon: "Building2",
        title: "Sekolah",
        description: "Pantau kegiatan dan kelola warga sekolah.",
      },
      {
        icon: "UsersRound",
        title: "Orang Tua",
        description: "Ikuti perkembangan belajar anak.",
      },
    ],
  },
  steps: {
    title: "Mulai kelola kelas dalam 4 langkah.",
    items: [
      {
        step: "1",
        title: "Siapkan",
        description: "Buat kelas dan rancang kegiatan belajar.",
      },
      {
        step: "2",
        title: "Undang",
        description: "Hubungkan siswa dan mulai pembelajaran.",
      },
      {
        step: "3",
        title: "Kelola",
        description: "Pantau tugas, absensi, dan penilaian.",
      },
      {
        step: "4",
        title: "Tumbuhkan",
        description: "Dorong literasi, karya, dan kemajuan siswa.",
      },
    ],
  },
  pricing: {
    ...LEGACY_LANDING_PAGE.pricing,
    title: "Pilihan untuk guru dan sekolah.",
    subtitle:
      "Mulai sesuai kebutuhan. Detail paket tersedia di halaman masing-masing.",
  },
  cta: {
    title: "Mulai kelola kelas hari ini.",
    subtitle: "Daftar gratis dan rasakan cara mengajar yang lebih mudah.",
    button: { label: "Daftar Gratis", href: "/register" },
  },
  header: { loginLabel: "Masuk", registerLabel: "Daftar Gratis" },
  footer: {
    description:
      "Membantu guru mengelola siswa dan memudahkan proses mengajar.",
  },
  experience: {
    heading: "Semua yang Anda butuhkan untuk mengajar.",
    classroom: {
      title: "Kelola kelas dengan mudah.",
      description:
        "Tugas, kuis, absensi, dan penilaian dalam satu ruang yang rapi untuk guru dan siswa.",
      link: { label: "Lihat kegiatan kelas", href: "/fitur/kelas" },
    },
    reading: {
      title: "Zona Baca untuk kebiasaan literasi.",
      description: "Bacaan digital yang menemani siswa belajar setiap hari.",
      link: { label: "Jelajahi Zona Baca", href: "/fitur/zona-baca" },
    },
    spotlight: {
      title: "Zona Kreasi untuk karya siswa.",
      description: "Tampilkan karya terbaik dan rayakan perkembangan kelas.",
      link: { label: "Jelajahi Zona Kreasi", href: "/fitur/spotlight" },
    },
    ai: {
      title: "AI sebagai asisten mengajar.",
      description:
        "Bantu susun dokumen pembelajaran. Guru tetap yang meninjau dan memutuskan.",
      link: { label: "Pelajari asisten AI", href: "/fitur/ai" },
    },
    app: {
      title: "Siap dipakai di web dan Android.",
      webDescription:
        "Kelola mengajar dan administrasi sekolah lewat browser.",
      androidDescription:
        "Siswa mengakses pembelajaran dari Android dengan akun sekolah.",
      androidUrl: "",
    },
    teacher: {
      title: "Untuk Guru",
      description: "Kelola siswa, kelas, dan pembelajaran harian Anda.",
      link: { label: "Lihat paket guru", href: "/paket/guru" },
    },
    school: {
      title: "Untuk Sekolah",
      description:
        "Kelola guru, siswa, dan kegiatan sekolah dalam satu tempat.",
      link: { label: "Lihat solusi sekolah", href: "/untuk-sekolah" },
    },
    parent: DEFAULT_LANDING_EXPERIENCE.parent,
  },
};

export const DEFAULT_LANDING_PAGE: LandingPageConfig = {
  ...LEGACY_LANDING_PAGE,
  schemaVersion: 5,
  hero: {
    badge: "Yayasan Ukhuwah Kalimantan Selatan · berdiri 1993",
    title: "Platform manajemen sekolah",
    titleHighlight: "Yayasan Ukhuwah.",
    subtitle:
      "UKHUWAH SYSTEM menghubungkan guru, siswa, dan orang tua di seluruh unit Pendidikan Islam Terpadu Yayasan Ukhuwah Kalimantan Selatan. Ini sistem internal yayasan—bukan layanan berlangganan umum.",
    primaryCta: { label: "Masuk", href: "/login" },
    secondaryCta: { label: "Kenali Fitur", href: "/fitur" },
    trustLine:
      "Berakhlak · Berprestasi · Mandiri · Berwawasan Lingkungan · Qur'ani · Terampil",
    stats: [
      { value: "1993", label: "Tahun berdiri yayasan" },
      { value: "PAUD–SMA", label: "Jenjang Islam terpadu" },
      { value: "7+", label: "Unit pendidikan naungan" },
    ],
  },
  features: {
    title: "Satu sistem untuk keluarga besar Ukhuwah",
    subtitle:
      "Dirancang untuk guru, pengelola unit sekolah, siswa, dan orang tua di lingkungan Yayasan Ukhuwah Kalimantan Selatan.",
    items: [
      {
        icon: "UserRound",
        title: "Guru",
        description:
          "Kelola kelas, absensi, tugas, ujian, penilaian, jurnal mengajar, dan perangkat ajar.",
      },
      {
        icon: "GraduationCap",
        title: "Siswa",
        description:
          "Kerjakan tugas, ikuti ujian, baca di Zona Baca, dan berkarya di mading serta Zona Kreasi.",
      },
      {
        icon: "Building2",
        title: "Sekolah",
        description:
          "Kelola guru, siswa, administrasi unit, PJJ, dan pantau kegiatan pembelajaran.",
      },
      {
        icon: "UsersRound",
        title: "Orang Tua",
        description:
          "Pantau kehadiran, nilai, dan perkembangan putra-putri dengan kode akses dari sekolah.",
      },
    ],
  },
  steps: {
    title: "Pembelajaran yang saling terhubung.",
    items: [
      {
        step: "1",
        title: "Siapkan",
        description: "Guru merancang kegiatan, tugas, dan perangkat ajar.",
      },
      {
        step: "2",
        title: "Undang",
        description: "Siswa masuk dengan akun yang disiapkan unit sekolah.",
      },
      {
        step: "3",
        title: "Kelola",
        description: "Pantau absensi, tugas, ujian, dan penilaian harian.",
      },
      {
        step: "4",
        title: "Libatkan",
        description: "Orang tua mengikuti perkembangan belajar anak.",
      },
    ],
  },
  pricing: {
    ...LEGACY_LANDING_PAGE.pricing,
    title: "Fitur untuk guru, sekolah, dan orang tua.",
    subtitle:
      "Akses mengikuti peran yang diberikan yayasan, bukan paket langganan publik.",
  },
  cta: {
    title: "Masuk sesuai peran Anda di Yayasan Ukhuwah.",
    subtitle:
      "Guru, pengelola sekolah, siswa, dan orang tua memakai akun yang disiapkan unit pendidikan masing-masing.",
    button: { label: "Masuk ke {appName}", href: "/login" },
  },
  header: { loginLabel: "Masuk", registerLabel: "Daftar akun guru" },
  footer: {
    description:
      "Platform manajemen sekolah milik Yayasan Ukhuwah Kalimantan Selatan. Menghubungkan guru, siswa, dan orang tua di seluruh unit pendidikan Islam terpadu.",
  },
  experience: DEFAULT_LANDING_EXPERIENCE,
};

// Only replace exact legacy defaults. Custom copy/links remain intact; no database writes.
function upgradeDefaults(
  value: unknown,
  oldDefault: unknown,
  newDefault: unknown,
): unknown {
  if (JSON.stringify(value) === JSON.stringify(oldDefault)) return newDefault;
  if (isObject(value) && isObject(oldDefault) && isObject(newDefault)) {
    const result = { ...value };
    for (const key of Object.keys(newDefault)) {
      result[key] =
        key in value
          ? upgradeDefaults(value[key], oldDefault[key], newDefault[key])
          : newDefault[key];
    }
    return result;
  }
  return value;
}

/** Recover malformed stored leaves without discarding valid neighboring settings. */
function normalizeShape(base: unknown, value: unknown): unknown {
  if (Array.isArray(base)) {
    if (!Array.isArray(value)) return base;
    if (!base.length)
      return value
        .filter(
          (v) =>
            isObject(v) &&
            typeof v.value === "string" &&
            typeof v.label === "string",
        )
        .slice(0, 6);
    return value.length
      ? value.slice(0, 8).map((v) => normalizeShape(base[0], v))
      : base;
  }
  if (isObject(base)) {
    const obj = isObject(value) ? value : {};
    return Object.fromEntries(
      Object.keys(base).map((key) => [
        key,
        normalizeShape(base[key], obj[key]),
      ]),
    );
  }
  return typeof value === typeof base && value !== null ? value : base;
}

export function normalizeLandingPage(value: unknown): LandingPageConfig {
  let working: unknown = value;
  if (isObject(value) && value.schemaVersion === 5) {
    working = value;
  } else if (isObject(value) && value.schemaVersion === 4) {
    working = upgradeDefaults(
      value,
      LANDING_PAGE_V4_DEFAULT,
      DEFAULT_LANDING_PAGE,
    );
  } else if (isObject(value) && value.schemaVersion === 3) {
    working = upgradeDefaults(value, LANDING_PAGE_V3_DEFAULT, DEFAULT_LANDING_PAGE);
  } else if (isObject(value) && value.schemaVersion === 2) {
    working = upgradeDefaults(value, LEGACY_LANDING_PAGE, DEFAULT_LANDING_PAGE);
  } else {
    working = upgradeDefaults(value, LEGACY_LANDING_PAGE, DEFAULT_LANDING_PAGE);
  }
  const result = normalizeShape(
    DEFAULT_LANDING_PAGE,
    working,
  ) as LandingPageConfig;
  // Read-time upgrade of exact previous button defaults only. Never write settings
  // on a public request, or overwrite a deliberately configured custom link.
  if (!isObject(value) || value.schemaVersion !== 5) {
    const links = [
      [result.hero.primaryCta, "Jelajahi Fitur", "#fitur", "/fitur"],
      [result.hero.secondaryCta, "Lihat Aplikasi", "#aplikasi", "/aplikasi"],
      [result.cta.button, "Kenali {appName}", "#mulai", "/fitur"],
      [
        result.experience!.classroom.link,
        "Kenali kegiatan kelas",
        "#mulai",
        "/fitur/kelas",
      ],
      [
        result.experience!.reading.link,
        "Kenali Zona Baca",
        "#panduan-baca",
        "/fitur/zona-baca",
      ],
      [
        result.experience!.spotlight.link,
        "Kenali Zona Kreasi",
        "#panduan-spotlight",
        "/fitur/spotlight",
      ],
      [
        result.experience!.ai.link,
        "Jelajahi AI",
        "/dashboard/tools",
        "/fitur/ai",
      ],
      [
        result.experience!.teacher.link,
        "Lihat Paket Guru",
        "/dashboard/billing",
        "/paket/guru",
      ],
      [
        result.experience!.school.link,
        "Lihat Solusi Sekolah",
        "#panduan-sekolah",
        "/untuk-sekolah",
      ],
    ] as const;
    for (const [link, label, oldHref, newHref] of links) {
      if (link.label === label && link.href === oldHref) link.href = newHref;
    }
  }
  result.schemaVersion = 5;
  return result;
}

export function resolveLandingIcon(name: string): LucideIcon {
  return LANDING_ICON_MAP[name] || FileText;
}
