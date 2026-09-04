"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Eye, Loader2, Pencil, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DocumentView } from "@/components/documents/document-view";
import { ModulAjarDocumentView } from "@/components/documents/modul-ajar-document-view";

export default function DocumentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [toolSlug, setToolSlug] = useState("");
  const [inputData, setInputData] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [error, setError] = useState("");
  const [documentLoaded, setDocumentLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/documents/${id}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "Dokumen tidak ditemukan");
        return data;
      })
      .then((d) => {
        if (d.document) {
          setTitle(d.document.title);
          setContent(d.document.content);
          setStatus(d.document.status);
          setToolSlug(d.document.toolSlug || "");
          setInputData((d.document.inputData as Record<string, string>) || {});
          setDocumentLoaded(true);
        }
      })
      .catch((event) => {
        setError(event instanceof Error ? event.message : "Gagal memuat dokumen");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Judul dokumen wajib diisi.");
      return;
    }
    if (!content.trim()) {
      setError("Konten dokumen wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status: "FINAL" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");
      if (!data?.document) throw new Error("Respons dokumen tidak lengkap");
      setTitle(data.document.title);
      setContent(data.document.content);
      setStatus(data.document.status);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: "pdf" | "docx") => {
    setExporting(format);
    setError("");
    try {
      const res = await fetch(`/api/documents/${id}/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Gagal mengunduh dokumen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${title.trim() || "dokumen-navalogi"}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Gagal mengunduh dokumen");
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/documents">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardShell>
    );
  }

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
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/documents">← Kembali</Link>
        </Button>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : null}

        {documentLoaded ? <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Label>Judul Dokumen</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <Badge variant={status === "FINAL" ? "success" : "warning"} className="shrink-0">
              {status === "FINAL" ? "Final" : "Draft"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Konten Dokumen</Label>
                <div className="inline-flex rounded-lg border p-0.5">
                  <button
                    type="button"
                    onClick={() => setMode("preview")}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      mode === "preview"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Pratinjau
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("edit")}
                    className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      mode === "edit"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>
              </div>
              {mode === "preview" ? (
                toolSlug === "modul-ajar" ? (
                  <ModulAjarDocumentView content={content} inputData={inputData} />
                ) : (
                  <DocumentView content={content} title={title} />
                )
              ) : (
                <textarea
                  className="min-h-[400px] w-full rounded-lg border p-4 font-mono text-sm"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleSave()} disabled={saving || !title.trim() || !content.trim()}>
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void handleExport("pdf")}
              >
                {exporting === "pdf" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exporting !== null}
                onClick={() => void handleExport("docx")}
              >
                {exporting === "docx" ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Word
              </Button>
            </div>
          </CardContent>
        </Card> : null}
      </div>
    </DashboardShell>
  );
}
