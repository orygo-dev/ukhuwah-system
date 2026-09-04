"use client";

import { useState } from "react";
import { Flag, Loader2, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const REASONS = [
  ["INAPPROPRIATE", "Konten tidak pantas"],
  ["BULLYING", "Perundungan atau pelecehan"],
  ["VIOLENCE", "Kekerasan atau tindakan berbahaya"],
  ["SEXUAL_CONTENT", "Konten seksual atau pornografi"],
  ["SPAM", "Spam atau menyesatkan"],
  ["PRIVACY", "Pelanggaran privasi"],
  ["OTHER", "Alasan lainnya"],
] as const;

export function StudentSpotlightReportButton({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!reason) return;
    if (reason === "OTHER" && details.trim().length < 5) {
      setError("Jelaskan alasan laporan minimal 5 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/student/spotlight-submissions/${submissionId}/reports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason, details: details.trim() || undefined }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Laporan belum dapat dikirim.");
      setOpen(false);
      setReason("");
      setDetails("");
      window.alert(data.message || "Laporan berhasil dikirim.");
      if (data.hidden) window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Laporan belum dapat dikirim.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Opsi Zona Kreasi"
        title="Opsi Zona Kreasi"
        onClick={() => setOpen(true)}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition hover:bg-black/75"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
              <div>
                <h2 className="text-xl font-black text-slate-950">Laporkan Zona Kreasi</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Identitas Anda dirahasiakan dari pembuat konten.
                </p>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 p-5">
              {REASONS.map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${
                    reason === value
                      ? "border-red-300 bg-red-50 text-red-800"
                      : "border-slate-200 text-slate-700"
                  }`}
                >
                  <input
                    type="radio"
                    name={`report-${submissionId}`}
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-red-600"
                  />
                  {label}
                </label>
              ))}
              {reason === "OTHER" ? (
                <Textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Jelaskan masalah pada konten ini..."
                />
              ) : null}
              {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
              <Button
                type="button"
                disabled={!reason || busy}
                onClick={() => void submit()}
                className="mt-3 w-full bg-red-600 hover:bg-red-700"
              >
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
                Kirim Laporan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
