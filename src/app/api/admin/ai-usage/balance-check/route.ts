import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveApiKey } from "@/lib/ai/provider";

export const runtime = "nodejs";

async function assertSuperAdmin() {
  const session = await auth();
  return session?.user?.role === "SUPER_ADMIN" ? session : null;
}

function pickOpenRouterCredits(payload: unknown) {
  const data =
    payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).data as Record<string, unknown> | undefined)
      : undefined;
  const root = payload as Record<string, unknown>;
  const totalCredits = Number(data?.total_credits ?? root?.total_credits);
  const totalUsage = Number(data?.total_usage ?? root?.total_usage);
  const balance =
    Number.isFinite(totalCredits) && Number.isFinite(totalUsage)
      ? totalCredits - totalUsage
      : Number(data?.balance ?? root?.balance);

  return Number.isFinite(balance) ? balance : null;
}

export async function POST(req: Request) {
  const session = await assertSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const providerId = typeof body.providerId === "string" ? body.providerId : "";
  const provider = await prisma.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) {
    return NextResponse.json({ error: "Provider tidak ditemukan" }, { status: 404 });
  }

  if (provider.slug !== "openrouter") {
    const snapshot = await prisma.aiProviderBalanceSnapshot.create({
      data: {
        providerId: provider.id,
        source: "unsupported",
        error:
          "Saldo realtime belum tersedia dari provider ini. Gunakan estimasi biaya dari log Navalogi.",
      },
    });
    return NextResponse.json({
      snapshot,
      message: "Provider ini belum menyediakan saldo realtime yang stabil.",
    });
  }

  try {
    const apiKey = resolveApiKey(provider.apiKey);
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof json?.error === "object"
          ? JSON.stringify(json.error)
          : `OpenRouter credits API gagal (${res.status})`
      );
    }

    const balance = pickOpenRouterCredits(json);
    const snapshot = await prisma.aiProviderBalanceSnapshot.create({
      data: {
        providerId: provider.id,
        amount: balance,
        currency: "USD",
        source: "openrouter_credits_api",
        raw: json,
      },
    });

    return NextResponse.json({
      snapshot,
      message:
        balance !== null
          ? `Saldo OpenRouter terdeteksi $${balance.toFixed(4)}`
          : "OpenRouter merespons, tetapi saldo tidak dapat dinormalisasi.",
    });
  } catch (err) {
    const snapshot = await prisma.aiProviderBalanceSnapshot.create({
      data: {
        providerId: provider.id,
        source: "openrouter_credits_api",
        error: err instanceof Error ? err.message : "Gagal cek saldo provider",
      },
    });
    return NextResponse.json(
      {
        snapshot,
        error: err instanceof Error ? err.message : "Gagal cek saldo provider",
      },
      { status: 502 }
    );
  }
}
