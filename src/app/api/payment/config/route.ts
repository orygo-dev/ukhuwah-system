import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMidtransConfig } from "@/lib/payment/midtrans";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isTeacherWorkspaceRole(session.user.role)) {
    return forbiddenRoleResponse("Konfigurasi checkout hanya tersedia untuk akun guru.");
  }

  const defaultGateway = await prisma.paymentGateway.findFirst({
    where: { isActive: true, isDefault: true },
  });

  const gateway =
    defaultGateway?.slug === "midtrans"
      ? defaultGateway
      : await prisma.paymentGateway.findFirst({
          where: { slug: "midtrans", isActive: true },
        });

  if (!gateway) {
    return NextResponse.json({
      midtrans: null,
      defaultGateway: defaultGateway
        ? {
            slug: defaultGateway.slug,
            name: defaultGateway.name,
            isSandbox: defaultGateway.isSandbox,
          }
        : null,
    });
  }

  const config = getMidtransConfig(gateway);
  if (!config.clientKey) {
    return NextResponse.json({
      midtrans: null,
      defaultGateway: defaultGateway
        ? {
            slug: defaultGateway.slug,
            name: defaultGateway.name,
            isSandbox: defaultGateway.isSandbox,
          }
        : undefined,
      error: "Client key belum diset",
    });
  }

  return NextResponse.json({
    midtrans: {
      clientKey: config.clientKey,
      isSandbox: !config.isProduction,
    },
    defaultGateway: defaultGateway
      ? {
          slug: defaultGateway.slug,
          name: defaultGateway.name,
          isSandbox: defaultGateway.isSandbox,
        }
      : undefined,
  });
}
