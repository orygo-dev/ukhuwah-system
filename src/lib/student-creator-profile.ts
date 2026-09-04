export type StudentCreatorIdentitySource = {
  id: string;
  name: string;
  avatarUrl: string | null;
  schoolName: string | null;
  className?: string | null;
};

export function publicStudentCreatorIdentity(
  source: StudentCreatorIdentitySource,
) {
  return {
    id: source.id,
    name: source.name,
    avatarUrl: source.avatarUrl,
    schoolName: source.schoolName?.trim() || "Sekolah belum tercantum",
    className: source.className?.trim() || null,
  };
}
