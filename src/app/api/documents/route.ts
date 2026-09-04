import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengakses dokumen generator.");
  }

  const documents = await prisma.document.findMany({
    where: session.user.role === "SUPER_ADMIN" ? {} : { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      toolSlug: true,
      status: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ documents });
}
