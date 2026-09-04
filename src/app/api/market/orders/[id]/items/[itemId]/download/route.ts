import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenRoleResponse, isMarketplaceBuyerRole } from "@/lib/api-role-guard";
import { readStoredUpload } from "@/lib/object-storage";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMarketplaceBuyerRole(session.user.role)) return forbiddenRoleResponse();
  const { id, itemId } = await params;

  const item = await prisma.marketplaceOrderItem.findFirst({
    where: {
      id: itemId,
      orderId: id,
      kind: "BOOK_DIGITAL",
      order: { buyerId: session.user.id, status: "PAID" },
    },
    include: { product: { select: { digitalFileName: true } } },
  });
  if (!item?.digitalFileKey) {
    return NextResponse.json({ error: "Unduhan tidak tersedia" }, { status: 404 });
  }

  const file = await readStoredUpload(item.digitalFileKey);
  if (!file) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }

  const filename = item.product.digitalFileName || `${item.title}.pdf`;
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
