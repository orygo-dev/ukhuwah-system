import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChatAllowMode, type ChatAllowMode } from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pengaturan pesan hanya tersedia untuk akun guru.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { profileDefaults: true },
  });

  return NextResponse.json({
    allowMessages: getChatAllowMode(user?.profileDefaults) === "all",
  });
}

const schema = z.object({
  allowMessages: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pengaturan pesan hanya tersedia untuk akun guru.");
  }

  try {
    const { allowMessages } = schema.parse(await req.json());
    const mode: ChatAllowMode = allowMessages ? "all" : "none";

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { profileDefaults: true },
    });

    const defaults =
      user?.profileDefaults && typeof user.profileDefaults === "object"
        ? (user.profileDefaults as Record<string, unknown>)
        : {};

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        profileDefaults: { ...defaults, chatAllowMessages: mode },
      },
    });

    return NextResponse.json({ allowMessages });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
