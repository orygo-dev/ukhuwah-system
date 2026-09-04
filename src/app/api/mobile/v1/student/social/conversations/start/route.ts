import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { mobileForbidden, mobileUnauthorized } from "@/lib/mobile-api";
import {
  findOrCreateStudentConversation,
  socialError,
  socialPair,
  studentRelationship,
} from "@/lib/student-social";

const schema = z.object({ studentId: z.string().min(1) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return mobileUnauthorized();
  if (session.user.role !== "STUDENT") return mobileForbidden();
  try {
    const { studentId } = schema.parse(await request.json());
    const { viewer, targetUserId } = await socialPair(session.user.id, studentId);
    const relationship = await studentRelationship(viewer.id, targetUserId);
    if (!relationship.canMessage) throw new Error("MESSAGE_NOT_ALLOWED");
    const conversation = await findOrCreateStudentConversation(viewer.id, targetUserId);
    return NextResponse.json({ conversationId: conversation.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Profil siswa tidak valid." }, { status: 400 });
    }
    const detail = socialError(error);
    return NextResponse.json({ error: detail.message, code: detail.code }, { status: 400 });
  }
}
