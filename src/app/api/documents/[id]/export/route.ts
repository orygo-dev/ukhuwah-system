import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportToDocx, exportToPdf } from "@/lib/export";
import { exportModulAjarDocx, exportModulAjarPdf } from "@/lib/export-modul-ajar";
import { sanitizeDocumentContent } from "@/lib/document-format";
import { getUserPlanEntitlements } from "@/lib/plan-limits";
import { forbiddenRoleResponse, isTeacherWorkspaceRole } from "@/lib/api-role-guard";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isTeacherWorkspaceRole(session.user.role)) {
      return forbiddenRoleResponse("Hanya akun guru yang dapat mengekspor dokumen generator.");
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "pdf";
    if (!["pdf", "docx"].includes(format)) {
      return NextResponse.json(
        { error: "Format export tidak valid. Gunakan pdf atau docx." },
        { status: 400 }
      );
    }

    const document = await prisma.document.findFirst({
      where: session.user.role === "SUPER_ADMIN" ? { id } : { id, userId: session.user.id },
    });

    if (!document) {
      return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      const { entitlements } = await getUserPlanEntitlements(session.user.id);
      if (format === "docx" && !entitlements.canExportDocx) {
        return NextResponse.json(
          { error: "Paket langganan Anda belum mencakup export DOCX." },
          { status: 403 }
        );
      }
      if (format !== "docx" && !entitlements.canExportPdf) {
        return NextResponse.json(
          { error: "Paket langganan Anda belum mencakup export PDF." },
          { status: 403 }
        );
      }
    }

    const safeName =
      document.title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim().slice(0, 80) ||
      "dokumen-navalogi";
    const content = sanitizeDocumentContent(document.content);
    const inputData = (document.inputData as Record<string, unknown> | null) ?? null;
    const isModulAjar = document.toolSlug === "modul-ajar";

    if (format === "docx") {
      const buffer = isModulAjar
        ? await exportModulAjarDocx(content, inputData)
        : await exportToDocx(document.title, content);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeName}.docx"`,
        },
      });
    }

    const buffer = isModulAjar
      ? await exportModulAjarPdf(content, inputData)
      : await exportToPdf(document.title, content);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[document export]", err);
    return NextResponse.json(
      { error: "Gagal membuat file export. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
