import {
  BookOpen,
  BarChart3,
  Building2,
  CalendarDays,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  Cloud,
  Coins,
  CreditCard,
  FileText,
  Gift,
  GraduationCap,
  Handshake,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  MessageSquare,
  MonitorPlay,
  MapPin,
  Newspaper,
  PenTool,
  School,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  User,
  Users,
  UserRound,
  Wallet,
  BrainCircuit,
  RadioTower,
  BellRing,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const APP_NAME = "UKHUWAH SYSTEM";

export const DEFAULT_BRAND_LOGO_URL = "/branding/ukhuwah-system-logo.png";

/** Nama produk lama yang masih tersimpan di pengaturan admin / salinan lama. */
export const LEGACY_APP_NAMES = new Set([
  "Guru Space",
  "GuruSpace",
  "GenPro",
  "GenPro Guru",
  "Navalogi",
]);

const LEGACY_LOGO_HINT = /navalogi|genpro|guruspace/i;

export function displayLogoUrl(value?: string | null) {
  const trimmed = value?.trim() || "";
  if (!trimmed || LEGACY_LOGO_HINT.test(trimmed)) return DEFAULT_BRAND_LOGO_URL;
  return trimmed;
}

export function displayAppName(value?: string | null) {
  const trimmed = value?.trim() || "";
  if (!trimmed || LEGACY_APP_NAMES.has(trimmed)) return APP_NAME;
  return trimmed;
}

export type ToolCategory = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "perangkat-ajar",
    label: "Perangkat Ajar",
    description: "RPP, Modul Ajar, Prota, Prosem, LKPD, Silabus",
    icon: BookOpen,
    color: "bg-blue-500",
  },
  {
    id: "asesmen",
    label: "Asesmen",
    description: "Bank soal, rubrik, narasi rapor",
    icon: ClipboardList,
    color: "bg-violet-500",
  },
  {
    id: "kelas",
    label: "Kelas & Kegiatan",
    description: "Jurnal mengajar dan catatan pembelajaran",
    icon: GraduationCap,
    color: "bg-emerald-500",
  },
  {
    id: "administrasi",
    label: "Administrasi Sekolah",
    description: "Surat dinas dan administrasi resmi",
    icon: School,
    color: "bg-amber-500",
  },
];

export type Tool = {
  slug: string;
  name: string;
  description: string;
  category: string;
  creditCost: number;
  icon: LucideIcon;
  popular?: boolean;
};

export type GeneratorGroup = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  tone: string;
  toolSlugs: string[];
};

/** Serializable tool metadata (safe for Server → Client props) */
export type ToolData = Omit<Tool, "icon">;

export const TOOLS: Tool[] = [
  {
    slug: "modul-ajar",
    name: "Modul Ajar / RPP",
    description: "Pembelajaran Mendalam sesuai Permendikdasmen 13/2025",
    category: "perangkat-ajar",
    creditCost: 2,
    icon: FileText,
    popular: true,
  },
  {
    slug: "atp",
    name: "ATP / Alur Tujuan Pembelajaran",
    description: "Alur CP, TP, materi, asesmen, dan alokasi waktu",
    category: "perangkat-ajar",
    creditCost: 2,
    icon: BookOpen,
    popular: true,
  },
  {
    slug: "bahan-ajar",
    name: "Bahan Ajar / Materi Ajar",
    description: "Materi siap ajar, contoh, latihan, dan rangkuman",
    category: "perangkat-ajar",
    creditCost: 1,
    icon: FileText,
  },
  {
    slug: "prota",
    name: "Program Tahunan",
    description: "Distribusi materi sepanjang tahun ajaran",
    category: "perangkat-ajar",
    creditCost: 2,
    icon: BookOpen,
  },
  {
    slug: "prosem",
    name: "Program Semester",
    description: "Rencana pembelajaran per semester",
    category: "perangkat-ajar",
    creditCost: 2,
    icon: BookOpen,
  },
  {
    slug: "lkpd",
    name: "LKPD",
    description: "Lembar kerja peserta didik interaktif",
    category: "perangkat-ajar",
    creditCost: 1,
    icon: PenTool,
    popular: true,
  },
  {
    slug: "silabus",
    name: "Silabus",
    description: "Silabus semester siap pakai dan siap cetak",
    category: "perangkat-ajar",
    creditCost: 2,
    icon: BookOpen,
  },
  {
    slug: "bank-soal",
    name: "Bank Soal",
    description: "PG, esai, isian — LOTS & HOTS",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardList,
    popular: true,
  },
  {
    slug: "kisi-kisi-soal",
    name: "Kisi-Kisi Soal",
    description: "Indikator, level kognitif, bentuk, dan nomor soal",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardList,
  },
  {
    slug: "kartu-soal",
    name: "Kartu Soal",
    description: "Kartu butir lengkap dengan stimulus dan pembahasan",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardCheck,
  },
  {
    slug: "analisis-penilaian",
    name: "Analisis Hasil Penilaian",
    description: "Ketuntasan, pemetaan nilai, dan tindak lanjut",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardCheck,
  },
  {
    slug: "remedial-pengayaan",
    name: "Remedial & Pengayaan",
    description: "Program tindak lanjut untuk siswa belum dan sudah tuntas",
    category: "asesmen",
    creditCost: 1,
    icon: GraduationCap,
  },
  {
    slug: "asesmen-diagnostik",
    name: "Asesmen Diagnostik",
    description: "Instrumen awal kognitif dan non-kognitif",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardList,
  },
  {
    slug: "rubrik",
    name: "Rubrik Penilaian",
    description: "Rubrik 4 level siap pakai",
    category: "asesmen",
    creditCost: 1,
    icon: ClipboardList,
  },
  {
    slug: "narasi-rapor",
    name: "Narasi Rapor",
    description: "Deskripsi capaian siswa yang humanis",
    category: "asesmen",
    creditCost: 1,
    icon: MessageSquare,
  },
  {
    slug: "jurnal-mengajar",
    name: "Jurnal Mengajar",
    description: "Catatan harian KBM dengan refleksi",
    category: "kelas",
    creditCost: 1,
    icon: PenTool,
  },
  {
    slug: "surat-dinas",
    name: "Surat Dinas",
    description: "Format resmi Kementerian",
    category: "administrasi",
    creditCost: 1,
    icon: FileText,
  },
];

export const GENERATOR_GROUPS: GeneratorGroup[] = [
  {
    id: "perangkat-ajar",
    label: "Perangkat Ajar",
    description: "Dokumen perencanaan pembelajaran dari ATP sampai modul ajar.",
    icon: BookOpen,
    color: "bg-blue-600",
    tone: "border-blue-100 bg-blue-50 text-blue-800",
    toolSlugs: ["modul-ajar", "atp", "bahan-ajar", "prota", "prosem", "lkpd", "silabus"],
  },
  {
    id: "asesmen-soal",
    label: "Asesmen & Soal",
    description: "Perangkat penilaian, bank soal, kisi-kisi, kartu soal, dan rubrik.",
    icon: ClipboardList,
    color: "bg-violet-600",
    tone: "border-violet-100 bg-violet-50 text-violet-800",
    toolSlugs: ["asesmen-diagnostik", "kisi-kisi-soal", "kartu-soal", "bank-soal", "rubrik"],
  },
  {
    id: "tindak-lanjut",
    label: "Tindak Lanjut Nilai",
    description: "Analisis hasil belajar, remedial, pengayaan, dan narasi rapor.",
    icon: GraduationCap,
    color: "bg-emerald-600",
    tone: "border-emerald-100 bg-emerald-50 text-emerald-800",
    toolSlugs: ["analisis-penilaian", "remedial-pengayaan", "narasi-rapor"],
  },
  {
    id: "administrasi-kelas",
    label: "Administrasi Kelas",
    description: "Catatan kegiatan pembelajaran dan dokumen harian kelas.",
    icon: PenTool,
    color: "bg-cyan-600",
    tone: "border-cyan-100 bg-cyan-50 text-cyan-800",
    toolSlugs: ["jurnal-mengajar"],
  },
  {
    id: "surat-admin",
    label: "Surat & Administrasi",
    description: "Dokumen resmi sekolah dan kebutuhan administrasi umum.",
    icon: FileText,
    color: "bg-amber-600",
    tone: "border-amber-100 bg-amber-50 text-amber-800",
    toolSlugs: ["surat-dinas"],
  },
];

export const KURIKULUM_OPTIONS = [
  { value: "merdeka", label: "Kurikulum Merdeka" },
  { value: "merdeka-dl", label: "Kurikulum Merdeka — Pembelajaran Mendalam" },
  { value: "k13", label: "Kurikulum 2013" },
  { value: "ktsp", label: "KTSP" },
  { value: "kbc", label: "Kurikulum Berbasis Cinta (Madrasah)" },
];

export const JENJANG_OPTIONS = [
  { value: "sd", label: "SD / MI", fase: ["A", "B", "C"] },
  { value: "smp", label: "SMP / MTs", fase: ["D"] },
  { value: "sma", label: "SMA / MA / SMK", fase: ["E", "F"] },
];

export const MAPEL_OPTIONS = [
  "Matematika",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "IPA",
  "IPS",
  "PKn",
  "Pendidikan Agama",
  "PJOK",
  "Seni Budaya",
  "Informatika",
  "Sejarah",
  "Ekonomi",
  "Biologi",
  "Fisika",
  "Kimia",
];

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  children?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  id: string;
  label: string;
  items: SidebarNavItem[];
};

export const ADMIN_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: "command",
    label: "Command Center",
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    id: "content",
    label: "Tampilan & Konten",
    items: [
      { href: "/admin/landing-page", label: "Landing Page", icon: LayoutTemplate },
      { href: "/admin/app-display", label: "Tampilan & Promo", icon: MonitorPlay },
      { href: "/admin/reels-ads", label: "Reels Ads", icon: Megaphone },
      { href: "/admin/content-review", label: "Review Konten", icon: ShieldCheck },
      { href: "/admin/zona-baca", label: "Zona Baca Global", icon: BookOpen },
      { href: "/admin/notifications", label: "Pemberitahuan", icon: BellRing },
    ],
  },
  {
    id: "platform",
    label: "Platform",
    items: [
      { href: "/admin/ai-settings", label: "Pengaturan AI", icon: Sparkles },
      { href: "/admin/ai-usage", label: "AI Usage & Cost", icon: BarChart3 },
      { href: "/admin/provider-clients", label: "Provider API", icon: KeyRound },
      { href: "/admin/payment-settings", label: "Payment Gateway", icon: Wallet },
      { href: "/admin/whatsapp-gateways", label: "WhatsApp Gateway", icon: MessageCircle },
      { href: "/admin/livekit", label: "LiveKit PJJ", icon: RadioTower },
      { href: "/admin/storage", label: "Storage R2", icon: Cloud },
      { href: "/admin/push-notifications", label: "Push Notifikasi", icon: BellRing },
      { href: "/admin/school-directory", label: "Wilayah & Sekolah", icon: MapPin },
    ],
  },
  {
    id: "monetization",
    label: "Monetisasi",
    items: [
      { href: "/admin/plans", label: "Paket Langganan", icon: Settings },
      { href: "/admin/school-commercialization", label: "Paket Sekolah", icon: Building2 },
      { href: "/admin/credit-packages", label: "Paket Top Up", icon: Coins },
      { href: "/admin/affiliate", label: "Afiliasi", icon: Handshake },
      { href: "/admin/partners", label: "Mitra Wilayah", icon: Building2 },
      { href: "/admin/reward", label: "Reward & Kredit", icon: Gift },
      { href: "/admin/market", label: "Marketplace", icon: ShoppingBag },
    ],
  },
  {
    id: "people",
    label: "Pengguna",
    items: [
      { href: "/admin/users", label: "Manajemen Pengguna", icon: Users },
      { href: "/admin/siswa-online", label: "Siswa Online", icon: RadioTower },
      { href: "/admin/account", label: "Akun & Keamanan", icon: KeyRound },
    ],
  },
  {
    id: "assessment",
    label: "Asesmen Nasional",
    items: [
      { href: "/admin/tka", label: "Bank TKA Global", icon: BrainCircuit },
      { href: "/admin/daily-quiz", label: "Quiz Harian Nasional", icon: ClipboardList },
    ],
  },
];

export const ADMIN_NAV: SidebarNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export const DASHBOARD_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: "utama",
    label: "Utama",
    items: [
      { href: "/dashboard", label: "Beranda", icon: LayoutDashboard },
      { href: "/dashboard/profil", label: "Profil Guru", icon: User },
    ],
  },
  {
    id: "ai-generator",
    label: "AI Generator",
    items: [
      { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles },
      {
        href: "/dashboard/tools?category=perangkat-ajar",
        label: "Perangkat Ajar",
        icon: BookOpen,
        children: [
          { href: "/dashboard/tools/modul-ajar", label: "Modul Ajar / RPP", icon: FileText },
          { href: "/dashboard/tools/atp", label: "ATP", icon: BookOpen },
          { href: "/dashboard/tools/bahan-ajar", label: "Bahan Ajar", icon: BookOpen },
          { href: "/dashboard/tools/prota", label: "PROTA", icon: CalendarDays },
          { href: "/dashboard/tools/prosem", label: "PROMES", icon: CalendarDays },
          { href: "/dashboard/tools/lkpd", label: "LKPD", icon: ClipboardList },
          { href: "/dashboard/tools/silabus", label: "Silabus", icon: FileText },
        ],
      },
      {
        href: "/dashboard/tools?category=asesmen-soal",
        label: "Asesmen & Soal",
        icon: ClipboardList,
        children: [
          { href: "/dashboard/tools/asesmen-diagnostik", label: "Asesmen Diagnostik", icon: ClipboardCheck },
          { href: "/dashboard/tools/kisi-kisi-soal", label: "Kisi-kisi Soal", icon: ClipboardList },
          { href: "/dashboard/tools/kartu-soal", label: "Kartu Soal", icon: FileText },
          { href: "/dashboard/tools/bank-soal", label: "Bank Soal", icon: ClipboardList },
          { href: "/dashboard/tools/rubrik", label: "Rubrik", icon: ClipboardCheck },
        ],
      },
      {
        href: "/dashboard/tools?category=tindak-lanjut",
        label: "Tindak Lanjut Nilai",
        icon: GraduationCap,
        children: [
          { href: "/dashboard/tools/analisis-penilaian", label: "Analisis Penilaian", icon: BarChart3 },
          { href: "/dashboard/tools/remedial-pengayaan", label: "Remedial & Pengayaan", icon: GraduationCap },
          { href: "/dashboard/tools/narasi-rapor", label: "Narasi Rapor", icon: FileText },
        ],
      },
      {
        href: "/dashboard/tools?category=administrasi-kelas",
        label: "Administrasi Kelas",
        icon: PenTool,
        children: [
          { href: "/dashboard/tools/jurnal-mengajar", label: "Jurnal Mengajar", icon: PenTool },
        ],
      },
      {
        href: "/dashboard/tools?category=surat-admin",
        label: "Surat & Administrasi",
        icon: FileText,
        children: [
          { href: "/dashboard/tools/surat-dinas", label: "Surat Dinas", icon: FileText },
        ],
      },
      { href: "/dashboard/tools", label: "Cari Semua Generator", icon: Sparkles },
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: [
      { href: "/dashboard/market", label: "Toko Buku & ATK", icon: ShoppingBag },
      { href: "/dashboard/market/cart", label: "Keranjang", icon: ShoppingCart },
      { href: "/dashboard/market/orders", label: "Riwayat Pesanan", icon: ClipboardList },
    ],
  },
  {
    id: "pembelajaran",
    label: "Pembelajaran",
    items: [
      { href: "/dashboard/kelas", label: "Kelas & Siswa", icon: School },
      { href: "/dashboard/akun-siswa", label: "Akun Siswa", icon: KeyRound },
      { href: "/dashboard/siswa-online", label: "Siswa Online", icon: RadioTower },
      { href: "/dashboard/pjj", label: "Kelas PJJ", icon: RadioTower },
      { href: "/dashboard/tugas", label: "Tugas / PR", icon: ClipboardCheck },
      { href: "/dashboard/exam", label: "Ujian Online", icon: ClipboardList },
      { href: "/dashboard/tka", label: "TKA", icon: BrainCircuit },
      { href: "/dashboard/zona-baca", label: "Zona Baca", icon: BookOpen },
      { href: "/dashboard/mading", label: "Mading Siswa", icon: Newspaper },
      { href: "/dashboard/jurnal", label: "Jurnal Harian", icon: PenTool },
      { href: "/dashboard/penilaian", label: "Penilaian", icon: ClipboardList },
      { href: "/dashboard/documents", label: "Dokumen Saya", icon: FileText },
      { href: "/dashboard/absensi", label: "Absensi", icon: ClipboardCheck },
    ],
  },
  {
    id: "komunitas",
    label: "Komunitas",
    items: [
      { href: "/dashboard/spotlight", label: "Zona Kreasi", icon: Clapperboard },
      { href: "/dashboard/spotlight-siswa", label: "Zona Kreasi Siswa", icon: Clapperboard },
      { href: "/dashboard/member", label: "Member", icon: UserRound },
      { href: "/dashboard/pesan", label: "Pesan", icon: MessageCircle },
      { href: "/dashboard/notifications", label: "Pemberitahuan", icon: BellRing },
    ],
  },
  {
    id: "akun",
    label: "Akun & Benefit",
    items: [
      { href: "/dashboard/reward", label: "Dapatkan Kredit", icon: Gift },
      { href: "/dashboard/topup", label: "Top Up Kredit", icon: Coins },
      { href: "/dashboard/billing", label: "Paket Langganan", icon: CreditCard },
      { href: "/dashboard/wallet", label: "Dompet", icon: Wallet },
      { href: "/dashboard/afiliasi", label: "Afiliasi", icon: Handshake },
      { href: "/dashboard/settings", label: "Pengaturan", icon: Settings },
    ],
  },
];

/** Flat list — derived from grouped nav for compatibility */
export const DASHBOARD_NAV = DASHBOARD_NAV_GROUPS.flatMap((group) => group.items);

export type MobileBottomNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  action?: "menu";
  isPrimary?: boolean;
  activePrefixes?: string[];
  badgeKey?: "chat";
};

/** Tab bar bawah untuk tampilan mobile (native-style) */
export const MOBILE_BOTTOM_NAV: MobileBottomNavItem[] = [
  {
    id: "home",
    href: "/dashboard",
    label: "Beranda",
    icon: LayoutDashboard,
  },
  {
    id: "spotlight",
    href: "/dashboard/spotlight",
    label: "Zona Kreasi",
    icon: Clapperboard,
    activePrefixes: ["/dashboard/spotlight"],
  },
  {
    id: "assistant",
    href: "/dashboard/assistant",
    label: "Assistant",
    icon: Sparkles,
    isPrimary: true,
    activePrefixes: ["/dashboard/assistant"],
  },
  {
    id: "chat",
    href: "/dashboard/pesan",
    label: "Pesan",
    icon: MessageCircle,
    activePrefixes: ["/dashboard/pesan"],
    badgeKey: "chat",
  },
  {
    id: "menu",
    label: "Menu",
    icon: LayoutGrid,
    action: "menu",
    activePrefixes: [
      "/dashboard/kelas",
      "/dashboard/tugas",
      "/dashboard/exam",
      "/dashboard/jurnal",
      "/dashboard/penilaian",
      "/dashboard/absensi",
      "/dashboard/documents",
      "/dashboard/tools",
      "/dashboard/profil",
      "/dashboard/member",
      "/dashboard/reward",
      "/dashboard/topup",
      "/dashboard/billing",
      "/dashboard/wallet",
      "/dashboard/afiliasi",
      "/dashboard/settings",
    ],
  },
];
