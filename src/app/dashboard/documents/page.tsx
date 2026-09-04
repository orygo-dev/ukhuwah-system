"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, MoreHorizontal, Search } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";

type Doc = {
  id: string;
  title: string;
  toolSlug: string;
  status: string;
  createdAt: string;
};

export default function DocumentsPage() {
  const { data: session } = useSession();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/documents")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "Gagal memuat dokumen");
        return data;
      })
      .then((d) => setDocuments(d.documents || []))
      .catch((err) => {
        setDocuments([]);
        setError(err instanceof Error ? err.message : "Gagal memuat dokumen");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(query.toLowerCase())
  );

  const safeDownloadName = (title: string) =>
    `${title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "dokumen-navalogi"}.pdf`;

  const handleExportPdf = async (doc: Doc) => {
    if (exporting) return;
    setExporting(doc.id);
    setError("");
    try {
      const res = await fetch(`/api/documents/${doc.id}/export?format=pdf`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Gagal mengunduh dokumen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeDownloadName(doc.title);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Gagal mengunduh dokumen");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DashboardShell
      activePath="/dashboard/documents"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dokumen Saya</h1>
            <p className="mt-1 text-muted-foreground">Arsip semua dokumen yang pernah Anda buat</p>
          </div>
          <Button variant="brand" asChild>
            <Link href="/dashboard/tools">+ Buat Dokumen Baru</Link>
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari dokumen..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Belum ada dokumen.{" "}
              <Link href="/dashboard/tools" className="text-primary hover:underline">
                Buat sekarang
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((doc) => (
              <Card key={doc.id} className="transition-colors hover:border-primary/20">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/dashboard/documents/${doc.id}`} className="truncate font-medium hover:text-primary">
                      {doc.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {doc.toolSlug}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <Badge variant={doc.status === "FINAL" ? "success" : "warning"}>
                    {doc.status === "FINAL" ? "Final" : "Draft"}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={exporting !== null}
                      onClick={() => void handleExportPdf(doc)}
                    >
                      {exporting === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/dashboard/documents/${doc.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
