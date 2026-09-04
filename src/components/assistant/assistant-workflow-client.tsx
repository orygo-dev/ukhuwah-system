"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AlertTriangle,
  X,
  Check,
  CheckCircle2,
  CircleDashed,
  Coins,
  Download,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DocumentView } from "@/components/documents/document-view";
import { ModulAjarDocumentView } from "@/components/documents/modul-ajar-document-view";
import { resolveDynamicOptions } from "@/lib/curriculum";
import { TOOLS, type Tool } from "@/lib/constants";
import type { AssistantWorkflow } from "@/lib/assistant-workflows";
import { getToolFormSteps, type FormField } from "@/lib/tool-forms";
import { cn } from "@/lib/utils";

type AssistantDocument = {
  id: string;
  title: string;
  toolSlug: string;
  status: string;
  createdAt: string;
};

type AssistantWorkflowClientProps = {
  workflows: AssistantWorkflow[];
  documents: AssistantDocument[];
  creditsRemaining: number;
  profileDefaults: Record<string, string>;
  toolConfigs: Record<string, { creditCost: number; isActive: boolean }>;
};

type DocumentState = "complete" | "draft" | "missing";
type AssistantPhase = "idle" | "thinking" | "recommendations";

type WorkflowRow = {
  item: AssistantWorkflow["items"][number];
  tool: Tool & { isActive?: boolean };
  document?: AssistantDocument;
  state: DocumentState;
};

const thinkingSteps = [
  "Membaca workflow yang dipilih",
  "Mengecek dokumen yang sudah tersedia",
  "Menganalisis prioritas dan urutan",
  "Menyusun rekomendasi aman",
];

const thinkingMessages = [
  "Saya membaca kebutuhan workflow dan dokumen yang relevan.",
  "Saya mengecek arsip dokumen Bapak/Ibu yang sudah dibuat atau masih draft.",
  "Saya menimbang urutan terbaik agar generator dipakai dengan konteks yang tepat.",
  "Saya menyusun rekomendasi dan rencana biaya yang aman sebelum generate.",
];

const assistantOpeningQuestion =
  "Halo Bapak/Ibu Guru. Hari ini ingin saya bantu menyiapkan apa?";
const assistantOpeningDescription =
  "Pilih salah satu tombol di bawah. Saya akan cek dokumen yang sudah ada, menyusun rekomendasi, lalu menghitung kredit sebelum generator dibuka.";

const dependencyReasons: Record<string, string> = {
  atp: "ATP menjadi dasar alur tujuan pembelajaran dan membantu dokumen semester tetap konsisten.",
  prota: "PROTA membantu memetakan distribusi materi dalam satu tahun ajaran.",
  prosem: "PROMES sebaiknya dibuat setelah ATP/PROTA agar rencana semester lebih terarah.",
  "modul-ajar": "Modul Ajar diperlukan sebagai rencana utama kegiatan pembelajaran.",
  "bahan-ajar": "Bahan Ajar membantu guru menyiapkan materi yang siap dipakai di kelas.",
  lkpd: "LKPD mendukung aktivitas siswa setelah rencana dan materi pembelajaran siap.",
  "asesmen-diagnostik": "Asesmen Diagnostik membantu memetakan kesiapan awal siswa.",
  "kisi-kisi-soal": "Kisi-Kisi Soal menjadi dasar indikator, bentuk soal, dan level kognitif.",
  "kartu-soal": "Kartu Soal membantu memvalidasi butir, kunci, skor, dan pembahasan.",
  "bank-soal": "Bank Soal sebaiknya dibuat setelah kisi-kisi agar paket soal tetap terarah.",
  rubrik: "Rubrik membantu penilaian kinerja, proyek, atau produk menjadi lebih objektif.",
  "analisis-penilaian": "Analisis Penilaian memetakan ketuntasan dan kebutuhan tindak lanjut.",
  "remedial-pengayaan": "Remedial dan Pengayaan menindaklanjuti hasil analisis nilai.",
  "narasi-rapor": "Narasi Rapor menyusun umpan balik siswa dengan bahasa yang lebih humanis.",
  "jurnal-mengajar": "Jurnal Mengajar mencatat aktivitas dan refleksi kegiatan kelas.",
  "surat-dinas": "Surat Dinas dipakai untuk kebutuhan administrasi resmi sekolah.",
};

const workflowButtonThemes = [
  "border-sky-100 bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-emerald-950 hover:border-sky-200",
  "border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] text-emerald-950 hover:border-emerald-200",
  "border-violet-100 bg-[linear-gradient(135deg,#f5f3ff,#ede9fe)] text-violet-950 hover:border-violet-200",
  "border-amber-100 bg-[linear-gradient(135deg,#fffbeb,#fef3c7)] text-amber-950 hover:border-amber-200",
  "border-rose-100 bg-[linear-gradient(135deg,#fff1f2,#ffe4e6)] text-rose-950 hover:border-rose-200",
  "border-cyan-100 bg-[linear-gradient(135deg,#ecfeff,#cffafe)] text-cyan-950 hover:border-cyan-200",
];

function getDocumentState(document?: AssistantDocument): DocumentState {
  if (!document) return "missing";
  return document.status === "FINAL" ? "complete" : "draft";
}

function buildReason(row: WorkflowRow, index: number) {
  if (row.state === "draft") {
    return `Dokumen ini sudah ada sebagai draft. Saya sarankan dilanjutkan sebelum membuat versi baru.`;
  }
  const base = dependencyReasons[row.tool.slug] || row.item.note;
  if (index === 0) return `${base} Ini menjadi prioritas pertama pada workflow ini.`;
  return base;
}

function ThinkingDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
    </span>
  );
}

function EmbeddedFieldRenderer({
  field,
  value,
  onChange,
  formData,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  formData: Record<string, string>;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                const next = active
                  ? selected.filter((item) => item !== option.value)
                  : [...selected, option.value];
                onChange(next.join("|"));
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                active
                  ? "border-blue-500 bg-emerald-50 text-slate-950"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-blue-600 bg-emerald-600 text-white" : "border-slate-300"
                )}
              >
                {active ? <Check className="h-3 w-3" /> : null}
              </span>
              {option.label}
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
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
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
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
    />
  );
}

export function AssistantWorkflowClient({
  workflows,
  documents,
  creditsRemaining,
  profileDefaults,
  toolConfigs,
}: AssistantWorkflowClientProps) {
  const [assistantDocuments, setAssistantDocuments] = useState(documents);
  const [availableCredits, setAvailableCredits] = useState(creditsRemaining);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AssistantPhase>("idle");
  const [thinkingStep, setThinkingStep] = useState(0);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [activeGeneratorSlug, setActiveGeneratorSlug] = useState<string | null>(null);
  const [typedOpening, setTypedOpening] = useState("");
  const [showOpeningActions, setShowOpeningActions] = useState(false);

  const latestByTool = useMemo(() => {
    const map = new Map<string, AssistantDocument>();
    for (const document of assistantDocuments) {
      if (!map.has(document.toolSlug)) map.set(document.toolSlug, document);
    }
    return map;
  }, [assistantDocuments]);

  const activeWorkflow = workflows.find((workflow) => workflow.id === activeWorkflowId);
  const toolMap = useMemo(() => {
    const entries: Array<[string, Tool & { isActive: boolean }]> = [];
    for (const tool of TOOLS) {
      const config = toolConfigs[tool.slug];
      const resolvedTool = {
        ...tool,
        creditCost: config?.creditCost ?? tool.creditCost,
        isActive: config?.isActive ?? true,
      };
      if (resolvedTool.isActive) {
        entries.push([
          tool.slug,
          resolvedTool,
        ]);
      }
    }
    return new Map(entries);
  }, [toolConfigs]);

  const workflowRows = useMemo<WorkflowRow[]>(() => {
    if (!activeWorkflow) return [];
    return activeWorkflow.items
      .map((item) => {
        const tool = toolMap.get(item.toolSlug);
        if (!tool) return null;
        const document = latestByTool.get(item.toolSlug);
        return {
          item,
          tool,
          document,
          state: getDocumentState(document),
        };
      })
      .filter(Boolean) as WorkflowRow[];
  }, [activeWorkflow, latestByTool, toolMap]);

  const recommendedRows = workflowRows.filter((row) => row.state !== "complete");
  const completeRows = workflowRows.filter((row) => row.state === "complete");
  const selectedRows = workflowRows.filter((row) => selectedSlugs.includes(row.tool.slug));
  const totalCost = selectedRows.reduce((total, row) => total + row.tool.creditCost, 0);
  const enoughCredits = availableCredits >= totalCost;
  const activeGeneratorRow =
    workflowRows.find((row) => row.tool.slug === activeGeneratorSlug) ?? null;
  const handleGenerated = (document: AssistantDocument, nextCredits: number) => {
    setAssistantDocuments((current) => [
      document,
      ...current.filter((item) => item.id !== document.id),
    ]);
    setAvailableCredits(nextCredits);
    setSelectedSlugs((current) => current.filter((slug) => slug !== document.toolSlug));
  };

  useEffect(() => {
    setAssistantDocuments(documents);
  }, [documents]);

  useEffect(() => {
    setAvailableCredits(creditsRemaining);
  }, [creditsRemaining]);

  useEffect(() => {
    let index = 0;
    let actionTimer: number | undefined;
    setTypedOpening("");
    setShowOpeningActions(false);

    const typingTimer = window.setInterval(() => {
      index += 1;
      setTypedOpening(assistantOpeningQuestion.slice(0, index));
      if (index >= assistantOpeningQuestion.length) {
        window.clearInterval(typingTimer);
        actionTimer = window.setTimeout(() => setShowOpeningActions(true), 380);
      }
    }, 28);

    return () => {
      window.clearInterval(typingTimer);
      if (actionTimer) window.clearTimeout(actionTimer);
    };
  }, []);

  useEffect(() => {
    if (phase !== "thinking") return;
    setThinkingStep(0);

    const timers = thinkingSteps.map((_, index) =>
      window.setTimeout(() => {
        setThinkingStep(index);
      }, index * 1150)
    );
    const finishTimer = window.setTimeout(() => {
      setPhase("recommendations");
    }, thinkingSteps.length * 1150 + 650);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(finishTimer);
    };
  }, [phase]);

  const chooseWorkflow = (workflowId: string) => {
    setActiveWorkflowId(workflowId);
    setSelectedSlugs([]);
    setPhase("thinking");
  };

  const toggleRecommendation = (slug: string) => {
    setSelectedSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-3 sm:space-y-5">
      <section className="overflow-hidden border-y border-emerald-100 bg-white shadow-[0_18px_54px_rgba(15,76,129,0.08)] sm:rounded-[22px] sm:border">
        <header className="flex items-center gap-3 border-b border-emerald-100 bg-[linear-gradient(135deg,#047857,#0d9488)] px-3 py-3 text-white sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-white/18 ring-1 ring-white/25 sm:h-11 sm:w-11">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold sm:text-xl">
                <span className="sm:hidden">AI Assistant</span>
                <span className="hidden sm:inline">AI Assistant Navalogi</span>
              </h1>
              <p className="truncate text-[11px] font-medium text-white/75 sm:text-xs">
                Bot workflow bertombol, tanpa prompt bebas
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/14 px-2.5 py-1.5 text-[11px] font-bold ring-1 ring-white/20 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs">
            <Coins className="h-4 w-4 text-amber-200" />
            {availableCredits} kredit
          </div>
        </header>

        <div className="bg-[#eef5ff] p-0 sm:p-5">
          <div className="min-h-[calc(100dvh-190px)] space-y-3 bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] p-2.5 sm:min-h-[560px] sm:space-y-4 sm:rounded-[18px] sm:border sm:border-emerald-100 sm:p-5">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-9 sm:w-9">
                <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tl-sm border border-emerald-100 bg-white px-3 py-2.5 shadow-sm sm:max-w-[760px] sm:rounded-2xl sm:px-4 sm:py-3">
                <p className="text-[13px] font-semibold text-slate-950 sm:text-sm">
                  {typedOpening}
                  {!showOpeningActions ? (
                    <span className="ml-1 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-emerald-600" />
                  ) : null}
                </p>
                {showOpeningActions ? (
                  <>
                    <p className="mt-1 animate-in fade-in slide-in-from-bottom-1 duration-300 text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
                      {assistantOpeningDescription}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-2">
                      {workflows.map((workflow, index) => {
                        const active = workflow.id === activeWorkflowId;
                        return (
                          <button
                            key={workflow.id}
                            type="button"
                            onClick={() => chooseWorkflow(workflow.id)}
                            style={{ transitionDelay: `${Math.min(index * 35, 180)}ms` }}
                            className={cn(
                              "group relative flex min-h-[86px] w-full flex-col justify-between overflow-hidden rounded-2xl border px-3 py-3 text-left shadow-sm transition-all duration-300 active:scale-[0.98] sm:min-h-[96px] sm:rounded-xl sm:hover:-translate-y-0.5",
                              "animate-in fade-in slide-in-from-bottom-2",
                              active
                                ? "border-emerald-300 bg-[linear-gradient(135deg,#047857,#0d9488)] text-white shadow-lg shadow-emerald-600/20"
                                : workflowButtonThemes[index % workflowButtonThemes.length]
                            )}
                          >
                            <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/70" />
                            <span className="flex items-start justify-between gap-2">
                              <span className="block text-xs font-extrabold leading-4 sm:text-sm sm:leading-5">
                                {workflow.title}
                              </span>
                              <span
                                className={cn(
                                  "grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors",
                                  active
                                    ? "bg-white/18 text-white"
                                    : "bg-white/70 text-emerald-700 ring-1 ring-black/5"
                                )}
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </span>
                            <span
                              className={cn(
                                "mt-2 block text-[11px] font-semibold leading-4 sm:text-xs sm:leading-5",
                                active ? "text-emerald-50" : "text-slate-600"
                              )}
                            >
                              {workflow.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
                    <span className="ml-1">menyiapkan pilihan...</span>
                  </div>
                )}
              </div>
            </div>

            {activeWorkflow ? (
              <div className="flex items-start justify-end gap-2.5 sm:gap-3">
                <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tr-sm bg-emerald-600 px-3 py-2.5 text-white shadow-lg shadow-emerald-600/20 sm:max-w-[680px] sm:rounded-2xl sm:px-4 sm:py-3">
                  <p className="text-[13px] font-semibold sm:text-sm">{activeWorkflow.title}</p>
                  <p className="mt-1 text-[11px] leading-4 text-emerald-50 sm:text-xs sm:leading-5">{activeWorkflow.goal}</p>
                </div>
              </div>
            ) : null}

            {activeWorkflow && phase === "thinking" ? (
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-9 sm:w-9">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tl-sm border border-emerald-100 bg-white px-3 py-2.5 shadow-sm sm:max-w-[760px] sm:rounded-2xl sm:px-4 sm:py-3">
                  <div className="mb-2.5 flex items-center gap-2 sm:mb-3">
                    <ThinkingDot />
                    <p className="text-[13px] font-bold text-slate-950 sm:text-sm">Saya sedang menganalisis...</p>
                  </div>
                  <p className="text-[12px] leading-5 text-slate-600 sm:text-sm sm:leading-6">{thinkingMessages[thinkingStep]}</p>
                  <div className="mt-3 grid gap-2 sm:mt-4 sm:block sm:space-y-2">
                    {thinkingSteps.map((step, index) => {
                      const done = index < thinkingStep;
                      const active = index === thinkingStep;
                      return (
                        <div
                          key={step}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] transition-all sm:gap-3 sm:px-3 sm:text-sm",
                            done
                              ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                              : active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-slate-100 bg-slate-50 text-slate-500"
                          )}
                        >
                          {done ? (
                            <Check className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                          ) : active ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin sm:h-4 sm:w-4" />
                          ) : (
                            <CircleDashed className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                          )}
                          <span className="font-semibold">{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {activeWorkflow && phase === "recommendations" ? (
              <>
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-9 sm:w-9">
                    <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                  <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tl-sm border border-emerald-100 bg-white px-3 py-2.5 shadow-sm sm:max-w-[840px] sm:rounded-2xl sm:px-4 sm:py-3">
                    <p className="text-[13px] font-bold text-slate-950 sm:text-sm">
                      Ini hasil pengecekan saya untuk {activeWorkflow.title}.
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
                      <div className="rounded-xl bg-slate-50 px-2 py-2 sm:px-3">
                        <p className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">Sudah ada</p>
                        <p className="text-base font-extrabold text-emerald-700 sm:text-lg">{completeRows.length}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2 sm:px-3">
                        <p className="truncate text-[10px] font-semibold text-slate-500 sm:text-[11px]">Rekomendasi</p>
                        <p className="text-base font-extrabold text-emerald-700 sm:text-lg">{recommendedRows.length}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-2 py-2 sm:px-3">
                        <p className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">Kredit</p>
                        <p className="text-base font-extrabold text-slate-950 sm:text-lg">{availableCredits}</p>
                      </div>
                    </div>

                    {recommendedRows.length > 0 ? (
                      <div className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                          Pilih dokumen yang ingin dibuat
                        </p>
                        {recommendedRows.map((row, index) => {
                          const selected = selectedSlugs.includes(row.tool.slug);
                          const ToolIcon = row.tool.icon;
                          return (
                            <button
                              key={row.tool.slug}
                              type="button"
                              onClick={() => toggleRecommendation(row.tool.slug)}
                              className={cn(
                                "flex w-full items-start gap-2.5 rounded-[18px] border p-2.5 text-left transition-all sm:gap-3 sm:rounded-2xl sm:p-3",
                                selected
                                  ? "border-blue-300 bg-emerald-50 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-emerald-200"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-lg border sm:mt-1 sm:h-6 sm:w-6",
                                  selected
                                    ? "border-blue-600 bg-emerald-600 text-white"
                                    : "border-slate-300 bg-white"
                                )}
                              >
                                {selected ? <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : null}
                              </span>
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary sm:h-10 sm:w-10">
                                <ToolIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <span className="text-[13px] font-bold text-slate-950 sm:text-base">{row.tool.name}</span>
                                  {index === 0 ? <Badge className="text-[10px]">Prioritas</Badge> : null}
                                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 sm:text-xs">
                                    {row.tool.creditCost} kredit
                                  </span>
                                </span>
                                <span className="mt-1 block text-[12px] leading-5 text-slate-500 sm:text-sm sm:leading-6">
                                  {buildReason(row, index)}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-[13px] text-emerald-800 sm:mt-4 sm:p-4 sm:text-sm">
                        Semua dokumen utama pada workflow ini sudah tersedia.
                      </div>
                    )}

                    {completeRows.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5 sm:mt-4 sm:p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 sm:text-xs">
                          Dokumen yang sudah ada
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {completeRows.map((row) => (
                            <Link
                              key={row.tool.slug}
                              href={row.document ? `/dashboard/documents/${row.document.id}` : "#"}
                              className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 sm:px-3 sm:text-xs"
                            >
                              {row.tool.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {selectedRows.length > 0 ? (
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-9 sm:w-9">
                      <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tl-sm border border-emerald-100 bg-white px-3 py-2.5 shadow-sm sm:max-w-[760px] sm:rounded-2xl sm:px-4 sm:py-3">
                      <p className="text-[13px] font-bold text-slate-950 sm:text-sm">
                        Berikut estimasi biaya sebelum generator dijalankan.
                      </p>
                      <div className="mt-3 space-y-2">
                        {selectedRows.map((row, index) => (
                          <div
                            key={row.tool.slug}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-2.5 py-2 text-[12px] sm:px-3 sm:text-sm"
                          >
                            <span className="font-semibold text-slate-700">
                              {index + 1}. {row.tool.name}
                            </span>
                            <span className="font-extrabold text-slate-950">{row.tool.creditCost} kredit</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 sm:mt-4 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12px] font-semibold text-slate-700 sm:text-sm">Total biaya</span>
                          <strong className="text-xl text-emerald-700 sm:text-2xl">{totalCost} kredit</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3 text-[12px] sm:text-sm">
                          <span className="text-slate-600">Sisa setelah generate</span>
                          <strong className={enoughCredits ? "text-emerald-700" : "text-destructive"}>
                            {enoughCredits ? `${availableCredits - totalCost} kredit` : "Kredit tidak cukup"}
                          </strong>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
                        {enoughCredits ? (
                          <Button
                            variant="brand"
                            size="sm"
                            className="col-span-2 h-10 text-xs sm:col-span-1 sm:h-11 sm:text-sm"
                            onClick={() => setActiveGeneratorSlug(selectedRows[0]?.tool.slug ?? null)}
                          >
                            Lanjutkan ke Generator
                            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        ) : (
                          <Button variant="brand" size="sm" className="col-span-2 h-10 text-xs sm:col-span-1 sm:h-11 sm:text-sm" asChild>
                            <Link href="/dashboard/billing">Top Up Kredit</Link>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-10 text-xs sm:h-11 sm:text-sm" onClick={() => setSelectedSlugs([])}>
                          Ubah pilihan
                        </Button>
                        <Button variant="ghost" size="sm" className="h-10 text-xs sm:h-11 sm:text-sm" onClick={() => chooseWorkflow(activeWorkflow.id)}>
                          <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          Analisis ulang
                        </Button>
                      </div>
                      <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-500 sm:p-3 sm:text-xs">
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Kredit belum dipotong di assistant. Kredit dipotong oleh generator setelah tombol Generate ditekan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 sm:h-9 sm:w-9">
                      <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </div>
                    <div className="max-w-[calc(100%-2.5rem)] rounded-[18px] rounded-tl-sm border border-emerald-100 bg-white px-3 py-2.5 text-[12px] leading-5 text-slate-600 shadow-sm sm:max-w-[620px] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm sm:leading-6">
                      Pilih minimal satu rekomendasi. Setelah itu saya tampilkan total biaya dan tombol lanjut ke generator.
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </section>

      {activeGeneratorRow ? (
        <EmbeddedGeneratorDrawer
          row={activeGeneratorRow}
          defaults={profileDefaults}
          creditsRemaining={availableCredits}
          onClose={() => setActiveGeneratorSlug(null)}
          onGenerated={handleGenerated}
        />
      ) : null}
    </div>
  );
}

function EmbeddedGeneratorDrawer({
  row,
  defaults,
  creditsRemaining,
  onClose,
  onGenerated,
}: {
  row: WorkflowRow;
  defaults: Record<string, string>;
  creditsRemaining: number;
  onClose: () => void;
  onGenerated: (document: AssistantDocument, nextCredits: number) => void;
}) {
  const router = useRouter();
  const steps = getToolFormSteps(row.tool.slug);
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>(defaults);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    id: string;
    title: string;
    content: string;
    toolSlug: string;
    status: string;
    isDemo?: boolean;
  } | null>(null);

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const currentStepValid =
    !currentStep ||
    currentStep.fields
      .filter((field) => field.required)
      .every((field) => (formData[field.name] || "").trim() !== "");

  const setField = (name: string, value: string) => {
    setFormData((current) => {
      const next = { ...current, [name]: value };
      for (const formStep of steps) {
        for (const field of formStep.fields) {
          if (field.dependsOn === name) next[field.name] = "";
        }
      }
      return next;
    });
  };

  const generate = async () => {
    if (!row.tool.isActive) {
      setError("Generator ini sedang dinonaktifkan oleh admin.");
      return;
    }
    if (creditsRemaining < row.tool.creditCost) {
      setError("Kredit tidak cukup untuk menjalankan generator ini.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolSlug: row.tool.slug, data: formData }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error || "Gagal generate");
      if (!json?.document?.id || !json.document.title || !json.document.content) {
        throw new Error("Respons generator tidak lengkap");
      }

      const nextResult = {
        id: json.document.id,
        title: json.document.title,
        content: json.document.content,
        toolSlug: json.document.toolSlug,
        status: json.document.status,
        isDemo: json.isDemo,
      };
      setResult(nextResult);
      onGenerated(
        {
          id: nextResult.id,
          title: nextResult.title,
          toolSlug: nextResult.toolSlug,
          status: nextResult.status,
          createdAt: new Date().toISOString(),
        },
        typeof json.creditsRemaining === "number"
          ? json.creditsRemaining
          : Math.max(creditsRemaining - row.tool.creditCost, 0)
      );
      router.refresh();
    } catch (event) {
      setError(event instanceof Error ? event.message : "Gagal generate");
    } finally {
      setGenerating(false);
    }
  };

  const safeDownloadName = (title: string, format: "pdf" | "docx") =>
    `${title
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "dokumen-navalogi"}.${format}`;

  const exportDocument = async (format: "pdf" | "docx") => {
    if (!result) return;
    setExporting(format);
    setError("");
    try {
      const response = await fetch(`/api/documents/${result.id}/export?format=${format}`);
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error || "Gagal mengunduh dokumen");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = safeDownloadName(result.title, format);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (event) {
      setError(event instanceof Error ? event.message : "Gagal mengunduh dokumen");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Tutup generator"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        onClick={onClose}
      />
      <section className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col bg-white shadow-2xl sm:inset-y-4 sm:right-4 sm:w-[min(960px,calc(100vw-2rem))] sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b bg-[linear-gradient(135deg,#eff6ff,#ffffff)] p-4 sm:gap-4 sm:p-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Generator resmi</Badge>
              <Badge>{row.tool.creditCost} kredit</Badge>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">{row.tool.name}</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-600 sm:text-sm sm:leading-6">
              Form ini dibuka dari AI Assistant. Tetap memakai generator dan endpoint yang sama.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 sm:p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  Dokumen berhasil dibuat
                </p>
                <p className="mt-1 text-[12px] leading-5 sm:text-sm sm:leading-6">
                  Status Assistant sudah diperbarui. Bapak/Ibu bisa export, melihat dokumen,
                  atau menutup drawer untuk melanjutkan rekomendasi berikutnya.
                </p>
              </div>

              {result.isDemo ? (
                <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  Hasil ini mode demo karena provider AI belum aktif.
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => void exportDocument("pdf")}
                  disabled={exporting !== null}
                >
                  {exporting === "pdf" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void exportDocument("docx")}
                  disabled={exporting !== null}
                >
                  {exporting === "docx" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  DOCX
                </Button>
                <Button asChild>
                  <Link href={`/dashboard/documents/${result.id}`}>Lihat Dokumen</Link>
                </Button>
              </div>

              {error ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              {row.tool.slug === "modul-ajar" ? (
                <ModulAjarDocumentView content={result.content} inputData={formData} />
              ) : (
                <DocumentView title={result.title} content={result.content} />
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="min-w-0 rounded-2xl border p-3 sm:p-5">
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-5 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {steps.map((formStep, index) => (
                    <button
                      key={formStep.id}
                      type="button"
                      onClick={() => setStep(index)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors sm:text-xs",
                        index === step
                          ? "bg-emerald-600 text-white"
                          : index < step
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {index + 1}. {formStep.label}
                    </button>
                  ))}
                </div>

                {currentStep ? (
                  <div className="space-y-4 sm:space-y-5">
                    <div>
                      <h3 className="text-base font-bold text-slate-950 sm:text-lg">{currentStep.label}</h3>
                      <p className="mt-1 text-[12px] text-slate-500 sm:text-sm">
                        Lengkapi data yang dibutuhkan sebelum generate.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                      {currentStep.fields.map((field) => (
                        <div
                          key={field.name}
                          className={cn("space-y-2", field.colSpan === 2 ? "sm:col-span-2" : "")}
                        >
                          <Label>
                            {field.label}
                            {field.required ? <span className="text-destructive"> *</span> : null}
                          </Label>
                          <EmbeddedFieldRenderer
                            field={field}
                            value={formData[field.name] || ""}
                            onChange={(value) => setField(field.name, value)}
                            formData={formData}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 text-xs sm:h-11 sm:text-sm"
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                    disabled={step === 0 || generating}
                  >
                    Kembali
                  </Button>
                  {isLastStep ? (
                    <Button
                      variant="brand"
                      size="sm"
                      className="h-10 text-xs sm:h-11 sm:text-sm"
                      onClick={generate}
                      disabled={
                        !currentStepValid ||
                        generating ||
                        !row.tool.isActive ||
                        creditsRemaining < row.tool.creditCost
                      }
                    >
                      {generating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menghasilkan...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate ({row.tool.creditCost} kredit)
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-10 text-xs sm:h-11 sm:text-sm"
                      onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
                      disabled={!currentStepValid || generating}
                    >
                      Lanjut
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <aside className="space-y-3">
                <div className="rounded-2xl border bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-950">Ringkasan biaya</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600">Biaya</span>
                      <strong>{row.tool.creditCost} kredit</strong>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-600">Kredit tersedia</span>
                      <strong>{creditsRemaining} kredit</strong>
                    </div>
                    <div className="flex justify-between gap-3 border-t pt-2">
                      <span className="text-slate-600">Sisa</span>
                      <strong className={creditsRemaining >= row.tool.creditCost ? "text-emerald-700" : "text-destructive"}>
                        {creditsRemaining >= row.tool.creditCost
                          ? `${creditsRemaining - row.tool.creditCost} kredit`
                          : "Tidak cukup"}
                      </strong>
                    </div>
                  </div>
                </div>
                <p className="rounded-2xl bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
                  Drawer ini menjaga konteks Assistant tetap aktif. Setelah dokumen dibuat, Bapak/Ibu
                  bisa menutup drawer dan melanjutkan rekomendasi berikutnya.
                </p>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
