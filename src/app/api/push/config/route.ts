import { NextResponse } from "next/server";
import { getPushNotificationPublicConfig } from "@/lib/push-notification-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getPushNotificationPublicConfig();
  return NextResponse.json({
    enabled: config.enabled && config.configured,
    androidChannelId: config.androidChannelId,
    web: config.web,
  });
}
