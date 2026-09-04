import type { ClassRoom, School, User } from "@prisma/client";
import { parseTeacherProfile } from "@/lib/teacher-profile";

export type MemberCard = {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  schoolName: string;
  schoolCity: string | null;
  jenjang: string;
  mapel: string;
  classes: { id: string; name: string; tahunAjaran: string }[];
  planName: string | null;
  joinedAt: string;
};

type UserWithRelations = User & {
  school: School | null;
  classRooms: ClassRoom[];
  plan?: { name: string; slug: string } | null;
};

export function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function memberAvatarFallback(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0d9488,059669,10b981`;
}

export function serializeMember(user: UserWithRelations): MemberCard {
  const profile = parseTeacherProfile(user);
  const schoolName =
    profile.sekolah || user.school?.name || "Sekolah belum diisi";
  const schoolCity = profile.kota || user.school?.city || null;

  return {
    id: user.id,
    name: profile.namaGuru || user.name,
    avatarUrl: user.avatarUrl,
    initials: memberInitials(profile.namaGuru || user.name),
    schoolName,
    schoolCity,
    jenjang: profile.jenjang || "—",
    mapel: profile.mapel || "—",
    classes: user.classRooms.map((c) => ({
      id: c.id,
      name: c.name,
      tahunAjaran: c.tahunAjaran,
    })),
    planName: user.plan?.slug && user.plan.slug !== "free" ? user.plan.name : null,
    joinedAt: user.createdAt.toISOString(),
  };
}

export function jenjangLabel(jenjang: string): string {
  const map: Record<string, string> = {
    sd: "SD",
    smp: "SMP",
    sma: "SMA",
    smk: "SMK",
  };
  return map[jenjang.toLowerCase()] || jenjang;
}
