import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationVisibilityWhere } from "@/lib/notifications";

const schema = z.object({ recipientId: z.string().min(1).optional(), all: z.boolean().optional() });

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success || (!parsed.data.recipientId && !parsed.data.all)) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const result = await prisma.notificationRecipient.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
      ...(parsed.data.all ? { notification: { is: notificationVisibilityWhere() } } : { id: parsed.data.recipientId }),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true, updated: result.count });
}
