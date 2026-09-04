import type { CreditLedgerSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreditChangeInput = {
  userId: string;
  amount: number;
  source: CreditLedgerSource;
  referenceId?: string;
  description: string;
  creditType?: string;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
};

export async function applyCreditChange(
  input: CreditChangeInput,
  tx?: Prisma.TransactionClient
): Promise<{ balanceAfter: number; ledgerId: string }> {
  const run = async (client: Prisma.TransactionClient) => {
    if (input.idempotencyKey) {
      const existing = await client.creditLedger.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, balanceAfter: true },
      });
      if (existing) {
        return { balanceAfter: existing.balanceAfter, ledgerId: existing.id };
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const user = await client.user.findUnique({
        where: { id: input.userId },
        select: { creditsRemaining: true },
      });
      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const balanceAfter = user.creditsRemaining + input.amount;
      if (balanceAfter < 0) {
        throw new Error("INSUFFICIENT_CREDITS");
      }

      const updated = await client.user.updateMany({
        where: {
          id: input.userId,
          creditsRemaining: user.creditsRemaining,
        },
        data: { creditsRemaining: balanceAfter },
      });

      if (updated.count !== 1) {
        continue;
      }

      const ledger = await client.creditLedger.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          balanceAfter,
          source: input.source,
          referenceId: input.referenceId,
          description: input.description.slice(0, 500),
          creditType: input.creditType || "GENERAL",
          expiresAt: input.expiresAt || undefined,
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return { balanceAfter, ledgerId: ledger.id };
    }

    throw new Error("CREDIT_CONFLICT");
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}

export async function spendCredits(
  userId: string,
  amount: number,
  source: CreditLedgerSource,
  referenceId: string,
  description: string,
  tx?: Prisma.TransactionClient,
  options?: Omit<CreditChangeInput, "userId" | "amount" | "source" | "referenceId" | "description">
) {
  return applyCreditChange(
    {
      userId,
      amount: -Math.abs(amount),
      source,
      referenceId,
      description,
      ...options,
    },
    tx
  );
}

export async function grantCredits(
  userId: string,
  amount: number,
  source: CreditLedgerSource,
  referenceId: string | undefined,
  description: string,
  tx?: Prisma.TransactionClient,
  options?: Omit<CreditChangeInput, "userId" | "amount" | "source" | "referenceId" | "description">
) {
  return applyCreditChange(
    {
      userId,
      amount: Math.abs(amount),
      source,
      referenceId,
      description,
      ...options,
    },
    tx
  );
}
