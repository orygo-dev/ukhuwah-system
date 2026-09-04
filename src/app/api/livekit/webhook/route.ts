import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLiveKitWebhookReceiver } from "@/lib/livekit";
import { processPjjWebhookEvent } from "@/lib/pjj-livekit-webhook";

export const runtime = "nodejs";

function retryResponse() {
  return NextResponse.json(
    { error: "Webhook belum tersimpan; silakan retry." },
    { status: 503, headers: { "Retry-After": "1" } }
  );
}

export async function POST(request: Request) {
  let receiver: Awaited<ReturnType<typeof getLiveKitWebhookReceiver>>;
  try {
    receiver = await getLiveKitWebhookReceiver();
  } catch {
    // Configuration/decryption/DB failures are not invalid signatures. Do not
    // log credentials, request body, Authorization header, or raw DB errors.
    console.error(JSON.stringify({ event: "pjj.webhook.config_unavailable" }));
    return retryResponse();
  }

  let event: Awaited<ReturnType<typeof receiver.receive>>;
  try {
    event = await receiver.receive(await request.text(), request.headers.get("authorization") || undefined);
  } catch {
    console.warn(JSON.stringify({ event: "pjj.webhook.signature_rejected" }));
    return NextResponse.json({ error: "Webhook tidak valid." }, { status: 401 });
  }

  try {
    await processPjjWebhookEvent(event, (operation) =>
      prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      })
    );
    console.info(JSON.stringify({ event: "pjj.webhook.processed", eventId: event.id, type: event.event }));
    return NextResponse.json({ received: true });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    if (code === "P2002") {
      // A uniqueness conflict in an attendance/usage row is NOT evidence of a
      // completed event. Only acknowledge a receipt from a committed transaction.
      try {
        const receipt = await prisma.liveKitWebhookEvent.findUnique({ where: { id: event.id }, select: { id: true } });
        if (receipt) {
          console.info(JSON.stringify({ event: "pjj.webhook.duplicate", eventId: event.id }));
          return NextResponse.json({ received: true, duplicate: true });
        }
      } catch {
        // Receipt lookup also failed: retain retry semantics.
      }
    }
    console.error(JSON.stringify({ event: "pjj.webhook.processing_failed", eventId: event.id, type: event.event, code: /^P\d{4}$/.test(code) ? code : "UNKNOWN" }));
    return retryResponse();
  }
}
