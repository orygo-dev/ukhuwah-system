import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isStalePrismaClient(client: PrismaClient): boolean {
  return (
    typeof (client as unknown as { rewardMission?: unknown }).rewardMission ===
      "undefined" ||
    typeof (client as unknown as { province?: unknown }).province ===
      "undefined" ||
    typeof (client as unknown as { regency?: unknown }).regency ===
      "undefined" ||
    typeof (client as unknown as { whatsAppGateway?: unknown }).whatsAppGateway ===
      "undefined" ||
    typeof (client as unknown as { whatsAppMessageLog?: unknown }).whatsAppMessageLog ===
      "undefined" ||
    typeof (client as unknown as { otpCode?: unknown }).otpCode ===
      "undefined" ||
    typeof (client as unknown as { teacherSchoolProfile?: unknown }).teacherSchoolProfile ===
      "undefined"
  );
}

function getPrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (process.env.NODE_ENV !== "production" && existing && isStalePrismaClient(existing)) {
    void existing.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = createPrismaClient();
    return globalForPrisma.prisma;
  }
  if (!existing) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
