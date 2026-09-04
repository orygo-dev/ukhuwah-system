import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

function documentAccessWhere(
  id: string,
  session: { user: { id: string; role: string } }
) {
  return session.user.role === "SUPER_ADMIN" ? { id } : { id, userId: session.user.id };
}

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengakses dokumen generator.");
  }

  const { id } = await params;
  const document = await prisma.document.findFirst({
    where: documentAccessWhere(id, session),
  });

  if (!document) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ document });
}

const patchSchema = z.object({
  title: z.string().trim().min(1, "Judul dokumen wajib diisi").max(160).optional(),
  content: z
    .string()
    .refine((value) => value.trim().length > 0, "Konten dokumen wajib diisi")
    .optional(),
  status: z.enum(["DRAFT", "FINAL"]).optional(),
});

export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Hanya akun guru yang dapat mengubah dokumen generator.");
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Data dokumen tidak valid" },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await prisma.document.findFirst({
    where: documentAccessWhere(id, session),
  });
  if (!existing) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...data,
      title: data.title?.trim(),
    },
  });

  return NextResponse.json({ document });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Hanya akun guru yang dapat menghapus dokumen generator.");
  }

  const { id } = await params;
  const existing = await prisma.document.findFirst({
    where: documentAccessWhere(id, session),
  });
  if (!existing) {
    return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
  }

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
