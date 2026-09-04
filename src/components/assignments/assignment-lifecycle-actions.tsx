"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, Lock, Loader2, RotateCcw, Send, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiError, readResponseJson } from "@/lib/http-json";

export function AssignmentLifecycleActions({ assignmentId, status, hasSubmissions, submissionClosed }: { assignmentId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; hasSubmissions: boolean; submissionClosed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patch = async (body: Record<string, unknown>, redirectToList = false) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(apiError(data, "Gagal memperbarui tugas"));
      if (redirectToList) router.push("/dashboard/tugas");
      else router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memperbarui tugas");
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/duplicate`, { method: "POST" });
      const data = await readResponseJson<{ assignment?: { id: string } }>(response);
      if (!response.ok || !data.assignment) throw new Error(apiError(data, "Gagal menduplikasi tugas"));
      router.push(`/dashboard/tugas?edit=${data.assignment.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menduplikasi tugas");
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(hasSubmissions ? "Tugas sudah memiliki jawaban dan akan diarsipkan. Lanjutkan?" : "Hapus tugas ini secara permanen?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE" });
      const data = await readResponseJson(response);
      if (!response.ok) throw new Error(apiError(data, "Gagal menghapus tugas"));
      router.push("/dashboard/tugas");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menghapus tugas");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> : null}
      {status === "DRAFT" ? <Button disabled={busy} onClick={() => patch({ status: "PUBLISHED" })}><Send className="mr-2 h-4 w-4" />Terbitkan</Button> : null}
      {status === "PUBLISHED" ? <Button disabled={busy} variant="outline" onClick={() => patch({ submissionClosed: !submissionClosed })}>{submissionClosed ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}{submissionClosed ? "Buka Pengumpulan" : "Tutup Pengumpulan"}</Button> : null}
      {status === "PUBLISHED" ? <Button disabled={busy} variant="outline" onClick={() => patch({ status: "ARCHIVED" }, true)}><Archive className="mr-2 h-4 w-4" />Arsipkan</Button> : null}
      {status === "ARCHIVED" ? <Button disabled={busy} onClick={() => patch({ status: "PUBLISHED" })}><RotateCcw className="mr-2 h-4 w-4" />Terbitkan Kembali</Button> : null}
      <Button disabled={busy} variant="outline" onClick={duplicate}><Copy className="mr-2 h-4 w-4" />Duplikasi</Button>
      {!hasSubmissions ? <Button disabled={busy} variant="destructive" onClick={remove}><Trash2 className="mr-2 h-4 w-4" />{status === "DRAFT" ? "Hapus Draft" : "Hapus Tugas"}</Button> : null}
      {error ? <p className="w-full text-sm font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
