import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUnreadCount } from "@/lib/chat";
import { forbiddenRoleResponse } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "TEACHER") {
    return forbiddenRoleResponse("Pesan guru hanya tersedia untuk akun guru.");
  }

  const unreadTotal = await getUnreadCount(session.user.id);
  return NextResponse.json({ unreadTotal });
}
