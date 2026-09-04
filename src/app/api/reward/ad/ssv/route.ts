import { NextResponse } from "next/server";
import { verifyAdMobSsvSignature, type AdMobSsvParams } from "@/lib/admob-ssv";
import { getRewardAdConfig } from "@/lib/reward-ad";
import { completeRewardAdFromSsv } from "@/lib/reward-ad-service";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const adConfig = await getRewardAdConfig();
  if (!adConfig.enabled || adConfig.provider !== "admob") {
    return new NextResponse("disabled", { status: 403 });
  }

  const url = new URL(req.url);
  const params: AdMobSsvParams = {
    ad_network: url.searchParams.get("ad_network") || "",
    ad_unit: url.searchParams.get("ad_unit") || "",
    custom_data: url.searchParams.get("custom_data") || undefined,
    reward_amount: url.searchParams.get("reward_amount") || "",
    reward_item: url.searchParams.get("reward_item") || "",
    timestamp: url.searchParams.get("timestamp") || "",
    transaction_id: url.searchParams.get("transaction_id") || "",
    user_id: url.searchParams.get("user_id") || "",
    signature: url.searchParams.get("signature") || "",
    key_id: url.searchParams.get("key_id") || "",
  };

  if (
    !params.ad_network ||
    !params.transaction_id ||
    !params.user_id ||
    !params.signature
  ) {
    return new NextResponse("invalid", { status: 400 });
  }

  const valid = await verifyAdMobSsvSignature(params);
  if (!valid) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  const sessionId = params.custom_data || "";
  if (!sessionId) {
    return new NextResponse("missing session", { status: 400 });
  }

  try {
    await completeRewardAdFromSsv({
      userId: params.user_id,
      sessionId,
      transactionId: params.transaction_id,
    });
    return new NextResponse("ok", { status: 200 });
  } catch {
    return new NextResponse("error", { status: 500 });
  }
}
