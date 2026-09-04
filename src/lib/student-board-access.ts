import "server-only";
import { prisma } from "@/lib/prisma";
import { studentBoardVisibilityClauses } from "@/lib/student-board-visibility";

export async function findAccessibleStudentBoardPost(userId: string, postId: string) {
  const student = await prisma.student.findFirst({
    where: { userId, isActive: true },
    select: {
      classRoomId: true,
      classRoom: { select: { schoolId: true, isActive: true } },
    },
  });
  if (!student?.classRoom.isActive) return null;

  return prisma.studentBoardPost.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      OR: studentBoardVisibilityClauses({
        classRoomId: student.classRoomId,
        schoolId: student.classRoom.schoolId,
      }),
    },
    select: { id: true },
  });
}
