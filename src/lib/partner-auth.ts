import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getAuthSecret } from "@/lib/runtime-config";

const COOKIE_NAME = "gs-partner-session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  return getAuthSecret();
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodePartnerSession(partnerId: string) {
  const payload = Buffer.from(
    JSON.stringify({ partnerId, iat: Date.now() }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodePartnerSession(value?: string) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      partnerId?: string;
      iat?: number;
    };
    if (!data.partnerId || !data.iat) return null;
    if (Date.now() - data.iat > SESSION_MAX_AGE * 1000) return null;
    return data.partnerId;
  } catch {
    return null;
  }
}

export async function setPartnerSession(partnerId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodePartnerSession(partnerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearPartnerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getPartnerSession() {
  const cookieStore = await cookies();
  const partnerId = decodePartnerSession(cookieStore.get(COOKIE_NAME)?.value);
  if (!partnerId) return null;

  const partner = await prisma.affiliatePartner.findFirst({
    where: { id: partnerId, isActive: true },
  });
  return partner;
}

export async function requirePartnerSession() {
  const partner = await getPartnerSession();
  if (!partner) throw new Error("UNAUTHORIZED");
  return partner;
}

export const partnerSessionCookieName = COOKIE_NAME;
