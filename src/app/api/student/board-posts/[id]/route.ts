import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Hanya penulis siswa yang dapat menghapus mading ini." },
      { status: 403 },
    );
  }

  const { id } = await params;
  try {
    // Ownership is checked atomically. Relations are removed by database cascades.
    const deleted = await prisma.studentBoardPost.deleteMany({
      where: {
        id,
        authorId: session.user.id,
        student: { userId: session.user.id, isActive: true },
      },
    });
    if (!deleted.count) {
      return NextResponse.json(
        { error: "Mading tidak ditemukan atau bukan milik Anda." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[student board post DELETE]", error);
    return NextResponse.json(
      { error: "Mading belum berhasil dihapus. Coba lagi." },
      { status: 500 },
    );
  }
}
