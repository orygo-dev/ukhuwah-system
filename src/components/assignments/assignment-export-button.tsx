"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = { nis: string | null; name: string; status: string; submittedAt: string | null; score: number | null; feedback: string | null };

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function AssignmentExportButton({ title, rows }: { title: string; rows: Row[] }) {
  const download = () => {
    const csv = [
      ["NIS", "Nama", "Status", "Waktu Pengumpulan", "Nilai", "Feedback"],
      ...rows.map((row) => [row.nis, row.name, row.status, row.submittedAt, row.score, row.feedback]),
    ].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `rekap-tugas-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kelas"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return <Button type="button" variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Unduh Rekap CSV</Button>;
}
