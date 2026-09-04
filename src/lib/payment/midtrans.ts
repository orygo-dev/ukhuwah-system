import crypto from "crypto";
import type { PaymentGateway } from "@prisma/client";
import { decrypt } from "@/lib/encryption";
import { isPlaceholderKey } from "@/lib/ai/constants";

type MidtransConfig = {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
};

function decryptConfigValue(value: string): string {
  if (!value) return "";
  try {
    const d = decrypt(value);
    return isPlaceholderKey(d) ? "" : d;
  } catch {
    return isPlaceholderKey(value) ? "" : value;
  }
}

export function getMidtransConfig(gateway: PaymentGateway): MidtransConfig {
  const raw = gateway.config as Record<string, string>;
  const serverKey = decryptConfigValue(raw.serverKey || raw.server_key || "");
  const clientKey = decryptConfigValue(raw.clientKey || raw.client_key || "");

  return {
    serverKey,
    clientKey,
    isProduction: !gateway.isSandbox,
  };
}

export async function createMidtransTransaction(
  gateway: PaymentGateway,
  params: {
    orderId: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    itemName: string;
  }
) {
  const config = getMidtransConfig(gateway);
  if (!config.serverKey) {
    throw new Error("Midtrans Server Key belum dikonfigurasi");
  }

  const baseUrl = config.isProduction
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";

  const auth = Buffer.from(config.serverKey + ":").toString("base64");

  const res = await fetch(`${baseUrl}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.amount,
      },
      customer_details: {
        first_name: params.customerName,
        email: params.customerEmail,
      },
      item_details: [
        {
          id: params.orderId,
          price: params.amount,
          quantity: 1,
          name: params.itemName.slice(0, 50),
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Midtrans: ${err.slice(0, 200)}`);
  }

  return res.json() as Promise<{ token: string; redirect_url: string }>;
}

export function verifyMidtransSignature(
  gateway: PaymentGateway,
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const config = getMidtransConfig(gateway);
  const expected = crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + config.serverKey)
    .digest("hex");
  return expected === signatureKey;
}

export function getMidtransSnapUrl(isSandbox: boolean): string {
  return isSandbox
    ? "https://app.sandbox.midtrans.com/snap/snap.js"
    : "https://app.midtrans.com/snap/snap.js";
}
