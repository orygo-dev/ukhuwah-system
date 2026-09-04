import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLiveSessionAccess } from "@/lib/pjj";
import { publishServerRoomData } from "@/lib/livekit";
import { encodeRoomData } from "@/components/pjj/room/live-room-data";
import {
  hydrateWhiteboardState,
  type PjjWhiteboardDelta,
  type PjjWhiteboardState,
} from "@/lib/pjj-whiteboard-state";

const strokeSchema = z.object({
  id: z.string().min(1).max(200),
  color: z.string().min(1).max(32),
  width: z.number().finite().min(1).max(50),
  erase: z.boolean(),
  points: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(2).max(200),
});
const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stroke"), stroke: strokeSchema }),
  z.object({ kind: z.literal("clear") }),
]);

type Params = { params: Promise<{ id: string }> };

function snapshotState(value: Prisma.JsonValue | null, version: number): PjjWhiteboardState {
  const parsed = z.object({ strokes: z.array(strokeSchema).max(500) }).safeParse(value);
  return { version, strokes: parsed.success ? parsed.data.strokes : [] };
}

function rowDelta(row: { sequence: number; kind: string; payload: Prisma.JsonValue | null }) {
  if (row.kind === "clear") return { sequence: row.sequence, kind: "clear" } as const;
  const parsed = strokeSchema.safeParse(row.payload);
  return parsed.success
    ? ({ sequence: row.sequence, kind: "stroke", stroke: parsed.data } as const)
    : null;
}

function schemaDriftMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/whiteboard_version|whiteboard_snapshot|live_class_whiteboard_events/i.test(message)) {
    return "Database papan belum lengkap. Tambahkan kolom/tabel whiteboard di MySQL (migrasi 202608120002).";
  }
  if (/does not exist in the current database/i.test(message)) {
    return "Database belum lengkap untuk papan. Jalankan migrasi whiteboard di server.";
  }
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
    }
    const { id } = await params;
    const access = await getLiveSessionAccess(session, id);
    if (!access.allowed) {
      return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
    }

    const liveSession = await prisma.liveClassSession.findUnique({
      where: { id },
      select: {
        whiteboardSnapshot: true,
        whiteboardSnapshotVersion: true,
        whiteboardVersion: true,
      },
    });
    if (!liveSession) {
      return NextResponse.json({ error: "Sesi PJJ tidak ditemukan." }, { status: 404 });
    }
    const rows = await prisma.liveClassWhiteboardEvent.findMany({
      where: { sessionId: id, sequence: { gt: liveSession.whiteboardSnapshotVersion } },
      orderBy: { sequence: "asc" },
      take: 101,
      select: { sequence: true, kind: true, payload: true },
    });
    const deltas = rows.map(rowDelta).filter(Boolean) as PjjWhiteboardDelta[];
    const state = hydrateWhiteboardState(
      snapshotState(liveSession.whiteboardSnapshot, liveSession.whiteboardSnapshotVersion),
      deltas
    );
    return NextResponse.json({ state: { ...state, version: liveSession.whiteboardVersion } });
  } catch (error) {
    console.error("[pjj whiteboard history]", error);
    const drift = schemaDriftMessage(error);
    return NextResponse.json(
      { error: drift || "Gagal memuat papan." },
      { status: drift ? 503 : 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Silakan masuk kembali." }, { status: 401 });
    }
    const { id } = await params;
    const access = await getLiveSessionAccess(session, id);
    if (!access.allowed) {
      return NextResponse.json({ error: "Anda tidak terdaftar pada sesi ini." }, { status: 403 });
    }

    const action = actionSchema.parse(await request.json());
    if (action.kind === "clear" && access.role === "STUDENT") {
      return NextResponse.json(
        { error: "Hanya moderator yang dapat mengosongkan papan." },
        { status: 403 }
      );
    }
    const persisted = await prisma.$transaction(
      async (tx) => {
        const liveSession = await tx.liveClassSession.update({
          where: { id, status: { notIn: ["ENDED", "CANCELLED"] } },
          data: { whiteboardVersion: { increment: 1 } },
          select: {
            roomName: true,
            whiteboardVersion: true,
            whiteboardSnapshotVersion: true,
            whiteboardSnapshot: true,
          },
        });
        await tx.liveClassWhiteboardEvent.create({
          data: {
            sessionId: id,
            authorId: session.user.id,
            sequence: liveSession.whiteboardVersion,
            kind: action.kind,
            payload: action.kind === "stroke" ? action.stroke : Prisma.JsonNull,
          },
        });

        if (liveSession.whiteboardVersion - liveSession.whiteboardSnapshotVersion >= 100) {
          const rows = await tx.liveClassWhiteboardEvent.findMany({
            where: { sessionId: id, sequence: { gt: liveSession.whiteboardSnapshotVersion } },
            orderBy: { sequence: "asc" },
            select: { sequence: true, kind: true, payload: true },
          });
          const deltas = rows.map(rowDelta).filter(Boolean) as PjjWhiteboardDelta[];
          const compacted = hydrateWhiteboardState(
            snapshotState(liveSession.whiteboardSnapshot, liveSession.whiteboardSnapshotVersion),
            deltas
          );
          await tx.liveClassSession.update({
            where: { id },
            data: {
              whiteboardSnapshot: { strokes: compacted.strokes } as Prisma.InputJsonValue,
              whiteboardSnapshotVersion: liveSession.whiteboardVersion,
            },
          });
          await tx.liveClassWhiteboardEvent.deleteMany({
            where: { sessionId: id, sequence: { lte: liveSession.whiteboardVersion } },
          });
        }
        return { roomName: liveSession.roomName, sequence: liveSession.whiteboardVersion };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const message = { type: "wb:persisted" as const, sequence: persisted.sequence, action };
    try {
      await publishServerRoomData(persisted.roomName, encodeRoomData(message), "pjj.whiteboard");
    } catch (error) {
      console.error("[pjj whiteboard broadcast]", error);
    }
    return NextResponse.json({ message });
  } catch (error) {
    console.error("[pjj whiteboard save]", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Perubahan papan tidak valid." }, { status: 400 });
    }
    const drift = schemaDriftMessage(error);
    return NextResponse.json(
      { error: drift || "Gagal menyimpan papan." },
      { status: drift ? 503 : 400 }
    );
  }
}
