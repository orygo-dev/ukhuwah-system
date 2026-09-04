import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLiveSessionAccess } from "@/lib/pjj";
import { pjjDiagnosticBatchSchema } from "@/lib/pjj-telemetry";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const access = await getLiveSessionAccess(session, id);
  if (!access.allowed) return new NextResponse(null, { status: 403 });

  try {
    const { events } = pjjDiagnosticBatchSchema.parse(await request.json());
    const participantHash = createHash("sha256").update(session.user.id).digest("hex").slice(0, 16);
    for (const event of events) {
      console.info(
        JSON.stringify({
          scope: "pjj.client",
          liveSessionId: id,
          participantHash,
          role: access.role,
          ...event,
        })
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Diagnostic payload tidak valid." }, { status: 400 });
  }
}
