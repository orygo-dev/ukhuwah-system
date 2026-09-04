import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { findAuthSessionCookieName } from "@/lib/auth-session-cookie";

function hasPartnerSessionCookie(req: NextRequest) {
  return Boolean(req.cookies.get("gs-partner-session")?.value);
}

function roleHome(role?: string) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "PROVINCE_ADMIN") return "/province";
  if (role === "SCHOOL_ADMIN") return "/school";
  if (role === "STUDENT") return "/student";
  if (role === "MERCHANT") return "/merchant";
  return "/dashboard";
}

function isPathAllowedForRole(pathname: string, role?: string) {
  if (pathname.startsWith("/admin")) return role === "SUPER_ADMIN";
  if (pathname.startsWith("/province")) return role === "PROVINCE_ADMIN";
  if (pathname.startsWith("/school")) return role === "SCHOOL_ADMIN";
  if (pathname.startsWith("/student")) return role === "STUDENT";
  if (pathname.startsWith("/merchant")) return role === "MERCHANT";
  if (pathname.startsWith("/dashboard")) {
    return (
      role !== "SUPER_ADMIN" &&
      role !== "PROVINCE_ADMIN" &&
      role !== "SCHOOL_ADMIN" &&
      role !== "STUDENT" &&
      role !== "MERCHANT"
    );
  }
  return true;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPartnerLoggedIn = hasPartnerSessionCookie(req);
  const sessionCookieName = findAuthSessionCookieName(
    req.cookies.getAll().map((cookie) => cookie.name)
  );
  const token = sessionCookieName
    ? await getToken({
        req,
        secret: process.env.AUTH_SECRET,
        cookieName: sessionCookieName,
        salt: sessionCookieName,
      })
    : null;
  // A cookie is accepted only after Auth.js successfully decrypts its JWT.
  const isLoggedIn = Boolean(token);
  const role = typeof token?.role === "string" ? token.role : undefined;

  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname.startsWith("/admin");
  const isProvince = pathname.startsWith("/province");
  const isSchool = pathname.startsWith("/school");
  const isStudent = pathname.startsWith("/student");
  const isMerchant = pathname.startsWith("/merchant");
  const isPartner = pathname.startsWith("/partner");
  const isPartnerPublic = pathname === "/partner/login";
  const isProtectedApp =
    isDashboard || isAdmin || isProvince || isSchool || isStudent || isMerchant;

  if (pathname.startsWith("/uploads/market/digital")) {
    return new NextResponse(null, { status: 404 });
  }

  if (isProtectedApp && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (isProtectedApp && token) {
    if (!isPathAllowedForRole(pathname, role)) {
      return NextResponse.redirect(new URL(roleHome(role), req.nextUrl.origin));
    }
  }

  if (isPartner && !isPartnerPublic && !isPartnerLoggedIn) {
    const url = new URL("/partner/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/province/:path*",
    "/school/:path*",
    "/student/:path*",
    "/merchant/:path*",
    "/partner/:path*",
    "/login",
    "/uploads/market/digital/:path*",
  ],
};
