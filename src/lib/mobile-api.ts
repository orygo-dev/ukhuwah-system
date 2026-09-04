import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { toSameOriginUploadUrl } from "@/lib/upload-url";

export const MOBILE_API_VERSION = "1.0";

export function mobileUnauthorized(message = "Sesi login tidak valid.") {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    { status: 401 }
  );
}
export function mobileForbidden(message = "Role akun tidak memiliki akses.") {
  return NextResponse.json(
    { error: message, code: "FORBIDDEN" },
    { status: 403 }
  );
}

export function serializeMobileUser(session: Session) {
  const rawAvatar = session.user.avatarUrl ?? null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId ?? null,
    studentId: session.user.studentId ?? null,
    creditsRemaining: session.user.creditsRemaining,
    avatarUrl: rawAvatar ? toSameOriginUploadUrl(rawAvatar) : null,
    membershipPlan: session.user.membershipPlan ?? null,
  };
}
