import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { touchStudentPresence } from "@/lib/student-presence";
import { allowsPresenceOrigin } from "@/lib/student-presence-policy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  // Native Android has no Origin; browser requests must stay same-origin.
  if (!allowsPresenceOrigin(request)) {
    return NextResponse.json({ error: "Origin tidak diizinkan." }, { status: 403, headers });
  }
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Silakan login kembali." }, { status: 401, headers });
    if (session.user.role !== "STUDENT" || !session.user.studentId) {
      return NextResponse.json({ error: "Hanya akun siswa aktif." }, { status: 403, headers });
    }
    // Identity and timestamp come exclusively from authenticated server state.
    // Request body/query IDs are never used to select another student.
    await touchStudentPresence(session.user.studentId);
    return new NextResponse(null, { status: 204, headers });
  } catch {
    // Optional presence failure must never turn into a login/session mutation.
    return NextResponse.json({ error: "Pemantauan sementara tidak tersedia." }, { status: 503, headers });
  }
}
