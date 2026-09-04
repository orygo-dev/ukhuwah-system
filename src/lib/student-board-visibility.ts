import type { Prisma } from "@prisma/client";

export const DEFAULT_STUDENT_BOARD_VISIBILITY = "GLOBAL" as const;

type StudentBoardAudience = {
  classRoomId: string;
  schoolId: string | null;
};

export function studentBoardVisibilityClauses(
  audience: StudentBoardAudience,
): Prisma.StudentBoardPostWhereInput[] {
  return [
    { visibility: "GLOBAL" },
    { visibility: "CLASS", classRoomId: audience.classRoomId },
    audience.schoolId
      ? {
          visibility: "SCHOOL",
          classRoom: { schoolId: audience.schoolId },
        }
      : { visibility: "SCHOOL", classRoomId: audience.classRoomId },
  ];
}
