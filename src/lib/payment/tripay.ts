import crypto from "crypto";
import type { PaymentGateway } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { isPlaceholderKey } from "@/lib/ai/constants";

type TripayConfig = {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  isSandbox: boolean;
};

function decryptVal(v: string): string {
  if (!v) return "";
  try {
    const d = decrypt(v);
    return isPlaceholderKey(d) ? "" : d;
  } catch {
    return isPlaceholderKey(v) ? "" : v;
  }
}

function getTripayConfig(gateway: PaymentGateway): TripayConfig {
  const raw = gateway.config as Record<string, string>;
  return {
    apiKey: decryptVal(raw.apiKey || ""),
    privateKey: decryptVal(raw.privateKey || ""),
    merchantCode: decryptVal(raw.merchantCode || ""),
    isSandbox: gateway.isSandbox,
  };
}

function signTripay(privateKey: string, merchantCode: string, merchantRef: string, amount: number) {
  const str = merchantCode + merchantRef + amount;
  return crypto.createHmac("sha256", privateKey).update(str).digest("hex");
}

export async function createTripayTransaction(
  gateway: PaymentGateway,
  params: {
    orderId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    itemName: string;
  }
) {
  const config = getTripayConfig(gateway);
  if (!config.apiKey || !config.privateKey || !config.merchantCode) {
    throw new Error("Tripay belum dikonfigurasi lengkap");
  }

  const baseUrl = config.isSandbox
    ? "https://tripay.co.id/api-sandbox"
    : "https://tripay.co.id/api";

  const signature = signTripay(
    config.privateKey,
    config.merchantCode,
    params.orderId,
    params.amount
  );

  const res = await fetch(`${baseUrl}/transaction/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      method: "QRIS",
      merchant_ref: params.orderId,
      amount: params.amount,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      order_items: [
        {
          name: params.itemName.slice(0, 50),
          price: params.amount,
          quantity: 1,
        },
      ],
      signature,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tripay: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || "Tripay transaction failed");
  }

  return {
    checkoutUrl: json.data.checkout_url as string,
    reference: json.data.reference as string,
    qrUrl: json.data.qr_url as string | undefined,
  };
}

export function verifyTripayCallback(
  gateway: PaymentGateway,
  callbackSignature: string,
  jsonBody: string
): boolean {
  const config = getTripayConfig(gateway);
  const expected = crypto
    .createHmac("sha256", config.privateKey)
    .update(jsonBody)
    .digest("hex");
  return expected === callbackSignature;
}
