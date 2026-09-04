import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SchoolCreditChange = {
  schoolId: string;
  subscriptionId: string;
  amount: number;
  source: string;
  description: string;
  userId?: string;
  referenceId?: string;
  idempotencyKey?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function applySchoolCreditChange(
  input: SchoolCreditChange,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: Prisma.TransactionClient) => {
    if (input.idempotencyKey) {
      const existing = await client.schoolCreditLedger.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, balanceAfter: true },
      });
      if (existing) return { ledgerId: existing.id, balanceAfter: existing.balanceAfter };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const subscription = await client.schoolSubscription.findFirst({
        where: { id: input.subscriptionId, schoolId: input.schoolId },
        select: { creditBalance: true },
      });
      if (!subscription) throw new Error("SCHOOL_SUBSCRIPTION_NOT_FOUND");
      const balanceAfter = subscription.creditBalance + input.amount;
      if (balanceAfter < 0) throw new Error("INSUFFICIENT_SCHOOL_CREDITS");

      const changed = await client.schoolSubscription.updateMany({
        where: {
          id: input.subscriptionId,
          schoolId: input.schoolId,
          creditBalance: subscription.creditBalance,
        },
        data: { creditBalance: balanceAfter, version: { increment: 1 } },
      });
      if (changed.count !== 1) continue;

      const ledger = await client.schoolCreditLedger.create({
        data: {
          schoolId: input.schoolId,
          subscriptionId: input.subscriptionId,
          userId: input.userId,
          amount: input.amount,
          balanceAfter,
          source: input.source,
          description: input.description.slice(0, 500),
          referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata,
        },
      });
      return { ledgerId: ledger.id, balanceAfter };
    }
    throw new Error("SCHOOL_CREDIT_CONFLICT");
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

export function spendSchoolCredits(
  input: Omit<SchoolCreditChange, "amount"> & { amount: number },
  tx?: Prisma.TransactionClient
) {
  return applySchoolCreditChange({ ...input, amount: -Math.abs(input.amount) }, tx);
}

export function grantSchoolCredits(
  input: Omit<SchoolCreditChange, "amount"> & { amount: number },
  tx?: Prisma.TransactionClient
) {
  return applySchoolCreditChange({ ...input, amount: Math.abs(input.amount) }, tx);
}
