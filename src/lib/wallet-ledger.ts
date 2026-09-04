import type { Prisma, WalletLedgerSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WalletChangeInput = {
  userId: string;
  amount: number;
  source: WalletLedgerSource;
  referenceId?: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
};

export async function applyWalletChange(
  input: WalletChangeInput,
  tx?: Prisma.TransactionClient
): Promise<{ balanceAfter: number; ledgerId: string }> {
  const run = async (client: Prisma.TransactionClient) => {
    if (input.idempotencyKey) {
      const existing = await client.walletLedger.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        select: { id: true, balanceAfter: true },
      });
      if (existing) {
        return { balanceAfter: Number(existing.balanceAfter), ledgerId: existing.id };
      }
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const user = await client.user.findUnique({
        where: { id: input.userId },
        select: { walletBalance: true },
      });
      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      const current = Number(user.walletBalance);
      const balanceAfter = Math.round((current + input.amount) * 100) / 100;
      if (balanceAfter < 0) {
        throw new Error("INSUFFICIENT_WALLET_BALANCE");
      }

      const updated = await client.user.updateMany({
        where: {
          id: input.userId,
          walletBalance: user.walletBalance,
        },
        data: { walletBalance: balanceAfter },
      });

      if (updated.count !== 1) {
        continue;
      }

      const ledger = await client.walletLedger.create({
        data: {
          userId: input.userId,
          amount: input.amount,
          balanceAfter,
          source: input.source,
          referenceId: input.referenceId,
          description: input.description.slice(0, 500),
          metadata: input.metadata,
          idempotencyKey: input.idempotencyKey,
        },
      });

      return { balanceAfter, ledgerId: ledger.id };
    }

    throw new Error("WALLET_CONFLICT");
  };

  if (tx) {
    return run(tx);
  }

  return prisma.$transaction(run);
}

export function creditWallet(
  userId: string,
  amount: number,
  source: WalletLedgerSource,
  referenceId: string | undefined,
  description: string,
  tx?: Prisma.TransactionClient,
  options?: Pick<WalletChangeInput, "metadata" | "idempotencyKey">
) {
  return applyWalletChange(
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

export function debitWallet(
  userId: string,
  amount: number,
  source: WalletLedgerSource,
  referenceId: string | undefined,
  description: string,
  tx?: Prisma.TransactionClient,
  options?: Pick<WalletChangeInput, "metadata" | "idempotencyKey">
) {
  return applyWalletChange(
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
