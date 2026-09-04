import "server-only";

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_RETRIES = 3;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

function databaseErrorCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : null;
}

export function clientAddress(headers: Headers) {
  const value =
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return value.trim().slice(0, 128) || "unknown";
}

function keyHash(bucket: string, identity: string) {
  return createHash("sha256")
    .update(`${bucket}\u0000${identity.trim().toLowerCase()}`)
    .digest("hex");
}

export async function consumeSecurityRateLimit(input: {
  bucket: string;
  identity: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const bucket = input.bucket.trim().slice(0, 64);
  if (!bucket || input.limit < 1 || input.windowMs < 1_000) {
    throw new Error("Invalid security rate-limit configuration");
  }

  const hash = keyHash(bucket, input.identity);
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const now = new Date();
    const nextExpiry = new Date(now.getTime() + input.windowMs);
    try {
      const record = await prisma.$transaction(
        async (tx) => {
          const current = await tx.securityRateLimit.findUnique({
            where: { keyHash: hash },
          });

          if (!current) {
            return tx.securityRateLimit.create({
              data: {
                keyHash: hash,
                bucket,
                count: 1,
                windowStartedAt: now,
                expiresAt: nextExpiry,
              },
            });
          }

          if (current.expiresAt <= now) {
            return tx.securityRateLimit.update({
              where: { keyHash: hash },
              data: {
                bucket,
                count: 1,
                windowStartedAt: now,
                expiresAt: nextExpiry,
              },
            });
          }

          return tx.securityRateLimit.update({
            where: { keyHash: hash },
            data: { count: { increment: 1 } },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Deterministic, low-frequency cleanup keeps abandoned identities bounded
      // without adding a cleanup query to every authentication request.
      if (hash.startsWith("00")) {
        await prisma.securityRateLimit.deleteMany({
          where: {
            expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
      }

      return {
        ok: record.count <= input.limit,
        remaining: Math.max(0, input.limit - record.count),
        retryAfterSec:
          record.count <= input.limit
            ? 0
            : Math.max(1, Math.ceil((record.expiresAt.getTime() - Date.now()) / 1000)),
      };
    } catch (error) {
      const code = databaseErrorCode(error);
      if ((code === "P2002" || code === "P2034") && attempt < MAX_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Security rate-limit transaction could not be completed");
}

export async function clearSecurityRateLimit(bucket: string, identity: string) {
  await prisma.securityRateLimit.deleteMany({
    where: { keyHash: keyHash(bucket.slice(0, 64), identity) },
  });
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return result.ok
    ? { "X-RateLimit-Remaining": String(result.remaining) }
    : {
        "X-RateLimit-Remaining": "0",
        "Retry-After": String(result.retryAfterSec),
      };
}
