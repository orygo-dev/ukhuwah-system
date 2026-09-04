import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";

export function isTeacherWorkspaceRole(role: UserRole) {
  return role === "TEACHER" || role === "SUPER_ADMIN";
}

export function isSchoolStaffRole(role: UserRole) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN";
}

export function isMarketplaceBuyerRole(role: UserRole) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN" || role === "SUPER_ADMIN";
}

export function isMerchantRole(role: UserRole) {
  return role === "MERCHANT";
}

export function forbiddenRoleResponse(message = "Role akun tidak memiliki akses ke fitur ini.") {
  return NextResponse.json({ error: message }, { status: 403 });
}
