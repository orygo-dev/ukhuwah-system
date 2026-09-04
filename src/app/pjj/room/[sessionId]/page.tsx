import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess, pjjHomeForRole } from "@/lib/pjj";
import { LiveClassRoomClient } from "@/components/pjj/live-class-room-client";
import { StudentPresenceHeartbeat } from "@/components/student/student-presence-heartbeat";

export const dynamic = "force-dynamic";

export default async function PjjRoomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/pjj/room/${sessionId}`);
  const backHref = pjjHomeForRole(session.user.role);
  const [liveSession, access] = await Promise.all([
    prisma.liveClassSession.findUnique({
      where: { id: sessionId },
      include: { classRoom: { select: { name: true } } },
    }),
    getLiveSessionAccess(session, sessionId),
  ]);
  if (!liveSession) notFound();
  if (!access.allowed) redirect(backHref);
  return (
    <>
      {session.user.role === "STUDENT" ? <StudentPresenceHeartbeat /> : null}
      <LiveClassRoomClient
        liveSessionId={liveSession.id}
        title={liveSession.title}
        className={liveSession.classRoom.name}
        role={access.role}
        backHref={backHref}
      />
    </>
  );
}
