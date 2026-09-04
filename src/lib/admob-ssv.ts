import { createVerify } from "crypto";

const KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";

type VerifierKey = { keyId: number; pem: string };

let cachedKeys: { fetchedAt: number; keys: VerifierKey[] } | null = null;
const CACHE_MS = 60 * 60 * 1000;

async function getVerifierKeys(): Promise<VerifierKey[]> {
  const now = Date.now();
  if (cachedKeys && now - cachedKeys.fetchedAt < CACHE_MS) {
    return cachedKeys.keys;
  }

  const res = await fetch(KEYS_URL, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error("ADMOB_KEYS_FETCH_FAILED");
  }

  const data = (await res.json()) as { keys: VerifierKey[] };
  cachedKeys = { fetchedAt: now, keys: data.keys || [] };
  return cachedKeys.keys;
}

export type AdMobSsvParams = {
  ad_network: string;
  ad_unit: string;
  custom_data?: string;
  reward_amount: string;
  reward_item: string;
  timestamp: string;
  transaction_id: string;
  user_id: string;
  signature: string;
  key_id: string;
};

function buildContentToVerify(params: AdMobSsvParams): string {
  const parts = [
    `ad_network=${encodeURIComponent(params.ad_network)}`,
    `ad_unit=${encodeURIComponent(params.ad_unit)}`,
    `reward_amount=${encodeURIComponent(params.reward_amount)}`,
    `reward_item=${encodeURIComponent(params.reward_item)}`,
    `timestamp=${encodeURIComponent(params.timestamp)}`,
    `transaction_id=${encodeURIComponent(params.transaction_id)}`,
    `user_id=${encodeURIComponent(params.user_id)}`,
  ];
  if (params.custom_data) {
    parts.splice(2, 0, `custom_data=${encodeURIComponent(params.custom_data)}`);
  }
  return parts.join("&");
}

export async function verifyAdMobSsvSignature(
  params: AdMobSsvParams
): Promise<boolean> {
  const keyId = Number(params.key_id);
  if (!params.signature || Number.isNaN(keyId)) {
    return false;
  }

  const keys = await getVerifierKeys();
  const key = keys.find((k) => k.keyId === keyId);
  if (!key?.pem) {
    return false;
  }

  const content = buildContentToVerify(params);
  const signature = Buffer.from(
    params.signature.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );

  try {
    const verifier = createVerify("SHA256");
    verifier.update(content);
    verifier.end();
    return verifier.verify(key.pem, signature);
  } catch {
    return false;
  }
}
