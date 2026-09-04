import { KURIKULUM_OPTIONS } from "@/lib/constants";

/** Profil guru yang disimpan di `User.profileDefaults` + field User terkait. */
export type TeacherProfile = {
  namaGuru: string;
  nip?: string;
  phone?: string;
  schoolId?: string;
  sekolah: string;
  npsn?: string;
  alamatSekolah?: string;
  kota?: string;
  provinsi?: string;
  jenjang: string;
  mapel: string;
  tahunAjaran: string;
  semester: string;
  kurikulum: string;
  profileCompletedAt?: string;
};

export type ProfileFieldKey = keyof TeacherProfile;

export const PROFILE_SECTIONS = [
  {
    id: "guru",
    title: "Identitas Guru",
    description: "Data diri guru yang tercantum di dokumen administrasi.",
    fields: ["namaGuru", "nip", "phone"] as ProfileFieldKey[],
  },
  {
    id: "sekolah",
    title: "Sekolah Utama",
    description: "Satuan pendidikan default untuk dashboard dan generator dokumen.",
    fields: ["schoolId", "sekolah", "npsn", "alamatSekolah", "kota", "provinsi"] as ProfileFieldKey[],
  },
  {
    id: "mengajar",
    title: "Mata Pelajaran Mengajar",
    description: "Jenjang dan mapel utama yang Anda ampu.",
    fields: ["jenjang", "mapel"] as ProfileFieldKey[],
  },
  {
    id: "periode",
    title: "Periode",
    description: "Tahun ajaran dan semester berjalan.",
    fields: ["tahunAjaran", "semester"] as ProfileFieldKey[],
  },
  {
    id: "kurikulum",
    title: "Kurikulum",
    description: "Kurikulum yang digunakan di sekolah Anda.",
    fields: ["kurikulum"] as ProfileFieldKey[],
  },
] as const;

const REQUIRED_FIELDS: ProfileFieldKey[] = [
  "namaGuru",
  "sekolah",
  "jenjang",
  "mapel",
  "tahunAjaran",
  "semester",
  "kurikulum",
];

export const PROFILE_FIELD_LABELS: Record<ProfileFieldKey, string> = {
  namaGuru: "Nama Guru",
  nip: "NIP",
  phone: "No. Telepon / WhatsApp",
  schoolId: "Sekolah Terdaftar",
  sekolah: "Nama Sekolah",
  npsn: "NPSN",
  alamatSekolah: "Alamat Sekolah",
  kota: "Kota / Kabupaten",
  provinsi: "Provinsi",
  jenjang: "Jenjang",
  mapel: "Mata Pelajaran Utama",
  tahunAjaran: "Tahun Ajaran",
  semester: "Semester",
  kurikulum: "Kurikulum",
  profileCompletedAt: "Profil dilengkapi",
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function currentTahunAjaran(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 7) {
    return `${year}/${year + 1}`;
  }
  return `${year - 1}/${year}`;
}

type UserProfileSource = {
  name: string;
  schoolId?: string | null;
  school?: {
    id?: string;
    name?: string | null;
    npsn?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    regency?: {
      name: string;
      province?: { name: string } | null;
    } | null;
  } | null;
  nip?: string | null;
  phone?: string | null;
  profileDefaults?: unknown;
};

export function parseTeacherProfile(
  user: UserProfileSource
): TeacherProfile {
  const raw =
    user.profileDefaults && typeof user.profileDefaults === "object"
      ? (user.profileDefaults as Record<string, unknown>)
      : {};

  return {
    namaGuru: str(raw.namaGuru) || str(user.name),
    nip: str(raw.nip) || str(user.nip),
    phone: str(raw.phone) || str(user.phone),
    schoolId: str(raw.schoolId) || str(user.schoolId),
    sekolah: str(raw.sekolah) || str(user.school?.name),
    npsn: str(raw.npsn) || str(user.school?.npsn),
    alamatSekolah: str(raw.alamatSekolah) || str(user.school?.address),
    kota: str(raw.kota) || str(user.school?.regency?.name) || str(user.school?.city),
    provinsi:
      str(raw.provinsi) ||
      str(user.school?.regency?.province?.name) ||
      str(user.school?.province),
    jenjang: str(raw.jenjang),
    mapel: str(raw.mapel),
    tahunAjaran: str(raw.tahunAjaran) || currentTahunAjaran(),
    semester: str(raw.semester),
    kurikulum: str(raw.kurikulum),
    profileCompletedAt: str(raw.profileCompletedAt) || undefined,
  };
}

export function validateTeacherProfile(profile: TeacherProfile): {
  complete: boolean;
  missing: ProfileFieldKey[];
} {
  const missing = REQUIRED_FIELDS.filter((key) => !str(profile[key]));
  return { complete: missing.length === 0, missing };
}

export function isTeacherProfileComplete(user: UserProfileSource): boolean {
  return validateTeacherProfile(parseTeacherProfile(user)).complete;
}

/** Nilai profil untuk pre-fill form generator dokumen. */
export function profileToFormDefaults(user: UserProfileSource): Record<string, string> {
  const p = parseTeacherProfile(user);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(p)) {
    if (key === "profileCompletedAt") continue;
    if (value) out[key] = value;
  }

  return out;
}

export function serializeTeacherProfile(
  profile: TeacherProfile,
  complete: boolean
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of Object.keys(PROFILE_FIELD_LABELS) as ProfileFieldKey[]) {
    if (key === "profileCompletedAt") continue;
    const value = str(profile[key]);
    if (value) data[key] = value;
  }
  if (complete) {
    data.profileCompletedAt = new Date().toISOString();
  }
  return data;
}

export function kurikulumLabel(value: string): string {
  return KURIKULUM_OPTIONS.find((k) => k.value === value)?.label ?? value;
}
