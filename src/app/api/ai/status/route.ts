import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAiAvailability } from "@/lib/ai/status";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getAiAvailability();
  return NextResponse.json(status);
}
