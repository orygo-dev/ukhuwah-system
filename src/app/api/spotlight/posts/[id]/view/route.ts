import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const post = await prisma.spotlightPost.findFirst({
    where: { id, isPublished: true },
    select: { id: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Zona Kreasi tidak ditemukan" }, { status: 404 });
  }

  const updated = await prisma.spotlightPost.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  return NextResponse.json({ viewCount: updated.viewCount });
}
