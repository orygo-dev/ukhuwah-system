export type StudentContentClassRoom = {
  school: { name: string } | null;
  teacher: {
    school: { name: string } | null;
    teachingProfiles: { schoolName: string }[];
  };
};

export function studentContentSchoolName(
  classRoom: StudentContentClassRoom,
) {
  return (
    classRoom.school?.name?.trim() ||
    classRoom.teacher.school?.name?.trim() ||
    classRoom.teacher.teachingProfiles[0]?.schoolName?.trim() ||
    null
  );
}
