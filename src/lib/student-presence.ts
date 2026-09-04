import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// No write to User/auth/session tables. The conditional update is monotonic
// across tabs/devices and throttles persisted writes to at most once per 30s.
export async function touchStudentPresence(studentId: string, now = new Date()) {
  const update = () => prisma.studentPresence.updateMany({
    where: { studentId, lastSeenAt: { lt: new Date(now.getTime() - 30_000) } },
    data: { lastSeenAt: now },
  });
  if ((await update()).count) return;
  if (await prisma.studentPresence.findUnique({ where: { studentId }, select: { studentId: true } })) return;
  try {
    await prisma.studentPresence.create({ data: { studentId, lastSeenAt: now } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    // Another heartbeat inserted the row. Do not overwrite a newer timestamp.
    await update();
  }
}
