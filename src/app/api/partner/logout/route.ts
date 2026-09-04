import { NextResponse } from "next/server";
import { clearPartnerSession } from "@/lib/partner-auth";

export async function POST() {
  await clearPartnerSession();
  return NextResponse.json({ success: true });
}
