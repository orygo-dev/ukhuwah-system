"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImportedStudent = {
  nis?: string;
  name: string;
  gender?: "L" | "P";
  parentPhone?: string;
};

type StudentImportToolsProps = {
  classId: string;
  saving: boolean;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  onImported: () => Promise<void>;
};

const TEMPLATE_ROWS = [
  ["nis", "nama_siswa", "jenis_kelamin", "no_hp_orang_tua"],
  ["12345", "Andi Pratama", "L", "6281234567890"],
  ["12346", "Citra Lestari", "P", "6281234567891"],
];

function toCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === ";" || char === "\t") && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeGender(value: string): "L" | "P" | undefined {
  const clean = value.trim().toUpperCase();
  if (["L", "LAKI", "LAKI_LAKI", "Laki-laki".toUpperCase()].includes(clean)) return "L";
  if (["P", "PEREMPUAN"].includes(clean)) return "P";
  return undefined;
}

function parseStudentsFromCsv(text: string): ImportedStudent[] {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("File masih kosong. Isi minimal satu baris data siswa.");
  }

  const headers = rows[0].map(normalizeHeader);
  const nameIndex = headers.findIndex((h) => ["nama_siswa", "nama", "name"].includes(h));
  const nisIndex = headers.findIndex((h) => ["nis", "nisn", "nomor_induk"].includes(h));
  const genderIndex = headers.findIndex((h) =>
    ["jenis_kelamin", "gender", "jk", "lp"].includes(h)
  );
  const parentPhoneIndex = headers.findIndex((h) =>
    ["no_hp_orang_tua", "hp_orang_tua", "parent_phone", "telepon_orang_tua"].includes(h)
  );

  if (nameIndex === -1) {
    throw new Error("Kolom nama siswa tidak ditemukan. Gunakan header nama_siswa.");
  }

  const students = rows
    .slice(1)
    .map((row) => ({
      nis: nisIndex >= 0 ? row[nisIndex]?.trim() || undefined : undefined,
      name: row[nameIndex]?.trim() || "",
      gender: genderIndex >= 0 ? normalizeGender(row[genderIndex] || "") : undefined,
      parentPhone:
        parentPhoneIndex >= 0 ? row[parentPhoneIndex]?.trim() || undefined : undefined,
    }))
    .filter((student) => student.name);

  if (!students.length) {
    throw new Error("Tidak ada nama siswa yang valid di file.");
  }

  return students;
}

export function StudentImportTools({
  classId,
  saving,
  setSaving,
  setError,
  onImported,
}: StudentImportToolsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [summary, setSummary] = useState("");

  const downloadTemplate = () => {
    const csv = TEMPLATE_ROWS.map((row) => row.map(toCsvValue).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-import-siswa-navalogi.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const uploadFile = async (file: File) => {
    setSaving(true);
    setError("");
    setSummary("");
    setFileName(file.name);

    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Saat ini upload mendukung file CSV. Gunakan template yang disediakan.");
      }

      const text = await file.text();
      const students = parseStudentsFromCsv(text);
      const res = await fetch(`/api/attendance/classes/${classId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal import siswa");

      const created = Number(data.summary?.created ?? data.students?.length ?? students.length);
      const skipped = Number(data.summary?.skipped ?? 0);
      setSummary(
        skipped > 0
          ? `${created} siswa berhasil diupload, ${skipped} duplikat dilewati dari ${file.name}.`
          : `${created} siswa berhasil diupload dari ${file.name}.`
      );
      await onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca file siswa");
    } finally {
      setSaving(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-slate-950">Import siswa dari file</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Download template, isi lewat Excel atau Spreadsheet, lalu upload kembali dalam format CSV.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="outline" className="bg-white" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
        <Button
          type="button"
          variant="brand"
          disabled={saving}
          onClick={() => inputRef.current?.click()}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Upload File
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />

      {(fileName || summary) && (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs text-slate-600">
          {summary || `File dipilih: ${fileName}`}
        </div>
      )}
    </div>
  );
}
