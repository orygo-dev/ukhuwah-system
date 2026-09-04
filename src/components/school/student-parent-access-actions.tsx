"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Loader2, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type StudentParentAccessActionsProps = {
  studentId: string;
  studentName: string;
  enabled: boolean;
  onChanged?: () => void | Promise<void>;
};

export function StudentParentAccessActions({
  studentId,
  studentName,
  enabled,
  onChanged,
}: StudentParentAccessActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );

  const generateCode = async () => {
    setLoading(true);
    setCode(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/students/${studentId}/parent-code`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat kode orang tua");
      setCode(data.code);
      setMessage({
        tone: "success",
        text: `Kode akses ${studentName} berhasil dibuat. Simpan sebelum menutup halaman.`,
      });
      await onChanged?.();
      router.refresh();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Gagal membuat kode orang tua",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeCode = async () => {
    if (!confirm(`Nonaktifkan akses orang tua untuk ${studentName}?`)) return;
    setLoading(true);
    setCode(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/students/${studentId}/parent-code`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal mencabut kode orang tua");
      setMessage({ tone: "success", text: "Akses orang tua berhasil dinonaktifkan." });
      await onChanged?.();
      router.refresh();
    } catch (err) {
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Gagal mencabut kode orang tua",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setMessage({ tone: "success", text: "Kode berhasil disalin." });
  };

  return (
    <div className="min-w-[220px] space-y-2">
      <Badge
        className={
          enabled
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : "bg-slate-100 text-slate-700 hover:bg-slate-100"
        }
      >
        {enabled ? "Akses orang tua aktif" : "Belum aktif"}
      </Badge>

      {code ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-xs font-bold text-emerald-900">Kode akses baru</p>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2">
            <span className="font-mono text-lg font-black tracking-widest text-slate-950">
              {code}
            </span>
            <Button type="button" size="icon" variant="ghost" onClick={copyCode}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"
          disabled={loading}
          onClick={generateCode}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {enabled ? "Buat ulang" : "Buat kode"}
        </Button>
        {enabled ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-xl text-red-600 hover:bg-red-50"
            disabled={loading}
            onClick={revokeCode}
          >
            <ShieldOff className="h-4 w-4" />
            Cabut
          </Button>
        ) : null}
      </div>

      {message ? (
        <p
          className={`text-xs font-semibold ${
            message.tone === "success" ? "text-emerald-700" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
