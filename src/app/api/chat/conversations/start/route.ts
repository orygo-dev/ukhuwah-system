import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  findOrCreateDirectConversation,
  serializeChatUser,
} from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

const schema = z.object({
  recipientId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  try {
    const { recipientId } = schema.parse(await req.json());
    const conversation = await findOrCreateDirectConversation(
      session.user.id,
      recipientId
    );

    const other = conversation.participants.find(
      (p) => p.userId !== session.user.id
    );

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        otherUser: other ? serializeChatUser(other.user) : null,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Gagal";
    const map: Record<string, string> = {
      SELF_CHAT: "Tidak bisa chat dengan diri sendiri",
      RECIPIENT_NOT_FOUND: "Guru tidak ditemukan",
      RECIPIENT_DISABLED_CHAT: "Guru ini tidak menerima pesan",
    };
    return NextResponse.json(
      { error: map[msg] || "Gagal memulai percakapan" },
      { status: 400 }
    );
  }
}
