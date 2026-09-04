import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { getAuthSecret } from "@/lib/runtime-config";

const COOKIE_NAME = "gs-parent-session";

function getSecret(): string {
  return getAuthSecret();
}

export function generateParentAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

export function normalizeParentAccessCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Deterministic lookup key so verify does not need O(n) bcrypt scans. */
export function parentAccessCodeLookupKey(code: string): string {
  return createHmac("sha256", getSecret())
    .update(`parent-code:${normalizeParentAccessCode(code)}`)
    .digest("hex");
}

export async function hashParentAccessCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeParentAccessCode(code), 10);
}

export async function verifyParentAccessCode(
  code: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(normalizeParentAccessCode(code), hash);
}

export function createParentSessionToken(studentId: string): string {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const data = `${studentId}.${exp}`;
  const sig = createHmac("sha256", getSecret()).update(data).digest("hex");
  return `${data}.${sig}`;
}

export function verifyParentSessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [studentId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!studentId || !exp || Number.isNaN(exp) || Date.now() > exp) return null;
  const data = `${studentId}.${expStr}`;
  const expected = createHmac("sha256", getSecret()).update(data).digest("hex");
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return studentId;
}

export function parentCookieName(): string {
  return COOKIE_NAME;
}

export function parentCookieOptions(maxAge = 7 * 24 * 60 * 60) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function readParentStudentId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  return verifyParentSessionToken(token);
}
