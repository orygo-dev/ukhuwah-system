"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { FormWizard } from "@/components/tools/form-wizard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getToolFormSteps, type FormField } from "@/lib/tool-forms";
import { resolveDynamicOptions } from "@/lib/curriculum";
import { DocumentView } from "@/components/documents/document-view";
import { ModulAjarDocumentView } from "@/components/documents/modul-ajar-document-view";
import type { ToolData } from "@/lib/constants";

type DocumentGeneratorProps = {
  tool: ToolData;
  creditsRemaining: number;
  defaults?: Record<string, string>;
};

function FieldRenderer({
  field,
  value,
  onChange,
  formData,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
  formData: Record<string, string>;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }
  if (field.type === "checkbox") {
    const options = field.optionsSource
      ? resolveDynamicOptions(field.optionsSource, formData)
      : field.options || [];
    const selected = value ? value.split("|").filter(Boolean) : [];
    const toggle = (val: string) => {
      const next = selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val];
      onChange(next.join("|"));
    };
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors sm:min-h-10 sm:rounded-lg sm:py-2 ${
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-white hover:bg-secondary/60"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }
  if (field.type === "select") {
    const options = field.optionsSource
      ? resolveDynamicOptions(field.optionsSource, formData)
      : field.options || [];
    const disabled = field.optionsSource && options.length === 0;

    return (
      <Select value={value} onValueChange={onChange} disabled={!!disabled}>
        <SelectTrigger>
          <SelectValue placeholder={disabled ? field.helperText || "Pilih..." : "Pilih..."} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      type={field.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

type AiStatus = {
  hasRealAi: boolean;
  demoMode: boolean;
  activeProvider: string | null;
  configuredProviders?: { name: string; slug: string; isActive: boolean; isFallback: boolean }[];
  message: string;
};

export function DocumentGenerator({
  tool,
  creditsRemaining,
  defaults = {},
}: DocumentGeneratorProps) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const steps = getToolFormSteps(tool.slug);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>(defaults);
  const [availableCredits, setAvailableCredits] = useState(creditsRemaining);
  const [generating, setGenerating] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    title: string;
    content: string;
    isDemo?: boolean;
    providerUsed?: string;
    qualityMessage?: string;
    wordCount?: number;
  } | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [previewMode, setPreviewMode] = useState<"template" | "full">(
    tool.slug === "modul-ajar" ? "full" : "template"
  );

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.message) setAiStatus(data);
      })
      .catch(() => {});
  }, []);

  const setField = (name: string, value: string) => {
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Reset dependent fields when their parent changes
      for (const s of steps) {
        for (const f of s.fields) {
          if (f.dependsOn === name) next[f.name] = "";
        }
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolSlug: tool.slug, data: formData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal generate");
      setResult({
        id: json.document.id,
        title: json.document.title,
        content: json.document.content,
        isDemo: json.isDemo,
        providerUsed: json.providerUsed,
        qualityMessage: json.quality?.qualityMessage,
        wordCount: json.quality?.wordCount,
      });
      if (typeof json.creditsRemaining === "number") {
        setAvailableCredits(json.creditsRemaining);
        try {
          await updateSession();
        } catch (sessionError) {
          console.error("Failed to refresh credit session after generate:", sessionError);
        }
      }
      setPreviewMode(tool.slug === "modul-ajar" ? "full" : json.isDemo ? "full" : "template");
      setStep(steps.length);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal generate");
    } finally {
      setGenerating(false);
    }
  };

  const runGenerate = () => {
    void handleGenerate();
  };

  const safeDownloadName = (title: string, format: "pdf" | "docx") =>
    `${title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "dokumen-navalogi"}.${format}`;

  const handleExport = async (format: "pdf" | "docx") => {
    if (!result) return;
    setExporting(format);
    setError("");
    try {
      const res = await fetch(`/api/documents/${result.id}/export?format=${format}`);
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Gagal mengunduh dokumen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeDownloadName(result.title, format);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh dokumen");
    } finally {
      setExporting(null);
    }
  };

  const handleSaveFinal = async () => {
    if (!result) return;
    setSavingFinal(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FINAL" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Gagal menyimpan");
      }
      router.push("/dashboard/documents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSavingFinal(false);
    }
  };

  const runSaveFinal = () => {
    void handleSaveFinal();
  };

  const isLastFormStep = step === steps.length - 1;
  const showResult = step >= steps.length && result;

  const currentStepValid =
    !steps[step] ||
    steps[step].fields
      .filter((f) => f.required)
      .every((f) => (formData[f.name] || "").trim() !== "");
  const isDemoResult =
    !!result?.isDemo || (!!aiStatus?.demoMode && !aiStatus?.hasRealAi);
  const isModulAjar = tool.slug === "modul-ajar";

  return (
    <div className="mx-auto max-w-5xl">
      <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2 sm:mb-4 sm:ml-0">
        <Link href="/dashboard/tools">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Kembali ke Generator
        </Link>
      </Button>

      <div className="mb-4 rounded-[1.35rem] border border-emerald-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,76,129,0.08)] sm:mb-6 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge>{tool.category}</Badge>
          <Badge variant="secondary">{tool.creditCost} kredit</Badge>
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">{tool.name}</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{tool.description}</p>
      </div>

      {aiStatus && !aiStatus.hasRealAi && (
        <div
          className={`mb-6 flex gap-3 rounded-lg border px-4 py-3 text-sm ${
            (aiStatus.configuredProviders?.length ?? 0) > 0
              ? "border-orange-300 bg-orange-50 text-orange-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            {aiStatus.demoMode ? (
              <>
                <p className="font-semibold">Mode demo aktif</p>
                <p className="mt-1">{aiStatus.message}</p>
              </>
            ) : (aiStatus.configuredProviders?.length ?? 0) > 0 ? (
              <>
                <p className="font-semibold">API key sudah tersimpan, tetapi provider belum aktif</p>
                <p className="mt-1">{aiStatus.message}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">AI belum terhubung</p>
                <p className="mt-1">{aiStatus.message}</p>
              </>
            )}
            <p className="mt-2 text-xs opacity-90">
              {aiStatus.demoMode ? (
                <>
                  Pratinjau dan export tetap bisa diuji dengan template simulasi. Jika ingin hasil AI
                  sungguhan, aktifkan provider di{" "}
                  <Link href="/admin/ai-settings" className="font-medium underline">
                    Pengaturan AI
                  </Link>
                  .
                </>
              ) : (
                <>
                  Super Admin →{" "}
                  <Link href="/admin/ai-settings" className="font-medium underline">
                    Pengaturan AI
                  </Link>{" "}
                  → pastikan toggle <strong>Primary aktif</strong> menyala → klik <strong>Simpan</strong>{" "}
                  → <strong>Test Koneksi</strong> harus ✓.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {aiStatus?.hasRealAi && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          ✓ {aiStatus.message} — dokumen akan disusun AI berdasarkan data form Anda.
        </div>
      )}

      <FormWizard
        className={showResult ? "max-w-5xl" : undefined}
        steps={[
          ...steps.map((s) => ({ id: s.id, label: s.label })),
          { id: "hasil", label: "Hasil" },
        ]}
        currentStep={showResult ? steps.length : step}
      >
        {!showResult && steps[step] && (
          <Card className="overflow-hidden rounded-[1.35rem] border-emerald-100 shadow-[0_14px_35px_rgba(15,76,129,0.08)] sm:rounded-lg sm:shadow-sm">
            <CardHeader className="border-b border-blue-50 bg-[linear-gradient(135deg,#f8fbff,#ffffff)] px-4 py-4 sm:px-6 sm:py-6">
              <CardTitle className="text-base font-extrabold sm:text-lg">{steps[step].label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 px-4 py-4 sm:px-6 sm:py-6">
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {steps[step].fields.map((field) => (
                  <div
                    key={field.name}
                    className={`space-y-2 ${field.colSpan === 2 ? "sm:col-span-2" : ""}`}
                  >
                    <Label>
                      {field.label}
                      {field.required && (
                        <span className="text-destructive"> *</span>
                      )}
                    </Label>
                    <FieldRenderer
                      field={field}
                      value={formData[field.name] || ""}
                      onChange={(v) => setField(field.name, v)}
                      formData={formData}
                    />
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-20 -mx-4 -mb-4 mt-2 grid grid-cols-2 gap-2 border-t border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:mb-0 sm:flex sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl text-sm sm:h-10 sm:rounded-lg"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Kembali
                </Button>

                {isLastFormStep ? (
                  <Button
                    variant="brand"
                    className="h-11 rounded-xl text-sm sm:h-10 sm:rounded-lg"
                    onClick={runGenerate}
                    disabled={
                      generating ||
                      !currentStepValid ||
                      availableCredits < tool.creditCost
                    }
                  >
                    {generating ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        {isModulAjar
                          ? isDemoResult
                            ? "Menyusun template modul (demo)..."
                            : "Menyusun modul lengkap (1–3 menit)..."
                          : "Menghasilkan..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1 h-4 w-4" />
                        Generate ({tool.creditCost} kredit)
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="h-11 rounded-xl text-sm sm:h-10 sm:rounded-lg"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!currentStepValid}
                  >
                    Lanjut
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>

              {isLastFormStep && (
                <p className="text-center text-xs text-muted-foreground">
                  Sisa kredit: {availableCredits}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {showResult && result && (
          <div className="space-y-4">
            {isDemoResult && (
              <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Hasil ini format simulasi, bukan keluaran AI real</p>
                  <p className="mt-1">
                    Struktur dokumen sudah mengikuti format final dan cocok untuk menguji preview,
                    heading, tabel, serta export. Isi narasi dan kedalaman pedagogisnya masih berupa
                    template simulasi, jadi belum bisa dipakai untuk menilai mutu AI sesungguhnya.
                  </p>
                  {result.providerUsed && (
                    <p className="mt-1 text-xs opacity-80">Provider: {result.providerUsed}</p>
                  )}
                </div>
              </div>
            )}

            {result.providerUsed && aiStatus?.hasRealAi && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900">
                Dokumen dihasilkan oleh AI ({result.providerUsed})
                {result.qualityMessage ? ` — ${result.qualityMessage}` : ""}
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Pratinjau dokumen siap cetak
                </p>
                <div className="inline-flex rounded-lg border p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode("template")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      previewMode === "template"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isModulAjar ? "Format Final" : "Tampilan Template"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode("full")}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      previewMode === "full"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isDemoResult ? "Isi Lengkap (Simulasi)" : "Isi Lengkap (AI)"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runGenerate}
                  disabled={generating || availableCredits < tool.creditCost}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Generate Ulang
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExport("pdf")}
                  disabled={exporting !== null}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExport("docx")}
                  disabled={exporting !== null}
                >
                  {exporting === "docx" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  Word
                </Button>
                <Button size="sm" onClick={runSaveFinal} disabled={savingFinal}>
                  {savingFinal ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>

            {previewMode === "template" && tool.slug === "modul-ajar" ? (
              <ModulAjarDocumentView content={result.content} inputData={formData} />
            ) : (
              <DocumentView content={result.content} title={result.title} />
            )}
          </div>
        )}
      </FormWizard>
    </div>
  );
}
