import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "STUDENT") return NextResponse.json({ error: "Hanya penulis siswa yang dapat menghapus konten ini." }, { status: 403 });
  const { id } = await params;
  try {
    // Atomic ownership check: a client-supplied author ID is never trusted.
    // Cascading relations remove likes/reports; concurrent review cannot republish a deleted row.
    const deleted = await prisma.studentSpotlightSubmission.deleteMany({
      where: { id, student: { userId: session.user.id, isActive: true } },
    });
    if (!deleted.count) return NextResponse.json({ error: "Konten tidak ditemukan atau bukan milik Anda." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[student spotlight DELETE]", error);
    return NextResponse.json({ error: "Konten belum berhasil dihapus. Coba lagi." }, { status: 500 });
  }
}
