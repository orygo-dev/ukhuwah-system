"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, Loader2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentOption = {
  id: string;
  name: string;
  nis: string | null;
  className: string;
};

type CreatedCredential = {
  studentId: string;
  name: string;
  className: string;
  email: string;
  password: string;
};

type BulkStudentAccountActionsProps = {
  students: StudentOption[];
  defaultDomain?: string | null;
  onChanged?: () => void | Promise<void>;
};

export function BulkStudentAccountActions({
  students,
  defaultDomain,
  onChanged,
}: BulkStudentAccountActionsProps) {
  const router = useRouter();
  const studentIdsKey = students.map((student) => student.id).join(",");
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    students.slice(0, 30).map((student) => student.id)
  );
  const [domain, setDomain] = useState(defaultDomain || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredential[]>([]);

  useEffect(() => {
    setSelectedIds(students.slice(0, 30).map((student) => student.id));
  }, [studentIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- sync when roster ids change

  useEffect(() => {
    if (defaultDomain && !domain) {
      setDomain(defaultDomain);
    }
  }, [defaultDomain, domain]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canSubmit = selectedIds.length > 0 && domain.trim().length >= 3;

  const toggleStudent = (studentId: string) => {
    setSelectedIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId]
    );
  };

  const activateBulk = async () => {
    const normalizedDomain = domain.trim().toLowerCase().includes("@")
      ? domain.trim().toLowerCase().split("@").pop() || ""
      : domain.trim().toLowerCase().replace(/^@+/, "");

    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedDomain)) {
      setMessage({
        tone: "error",
        text: "Domain email tidak valid. Contoh: siswa.sekolah.sch.id (tanpa @).",
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    setCredentials([]);
    setDomain(normalizedDomain);
    try {
      const res = await fetch("/api/students/accounts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedIds,
          emailDomain: normalizedDomain,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          tone: "error",
          text:
            data.error ||
            `Gagal aktivasi massal akun siswa (HTTP ${res.status}).`,
        });
        return;
      }
      const createdCount = data.created?.length || 0;
      const skippedCount = data.skipped?.length || 0;
      setCredentials(data.created || []);
      setMessage({
        tone: "success",
        text:
          skippedCount > 0
            ? `${createdCount} akun dibuat, ${skippedCount} dilewati.`
            : `${createdCount} akun siswa berhasil dibuat.`,
      });
      setSelectedIds([]);
      await onChanged?.();
      router.refresh();
    } catch {
      setMessage({
        tone: "error",
        text: "Tidak dapat menghubungi server untuk aktivasi massal.",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCredentials = async () => {
    const text = credentials
      .map(
        (item) =>
          `${item.name} (${item.className})\nEmail: ${item.email}\nPassword: ${item.password}`
      )
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setMessage({ tone: "success", text: "Daftar kredensial berhasil disalin." });
  };

  if (students.length === 0) {
    return (
      <Card className="rounded-[24px] border-emerald-100 bg-emerald-50/70">
        <CardContent className="flex items-center gap-3 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          <div>
            <p className="font-extrabold text-emerald-950">Semua siswa sudah memiliki akun</p>
            <p className="mt-1 text-sm text-emerald-800">
              Tidak ada siswa aktif yang perlu diaktifkan loginnya.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_42px_rgba(15,76,129,0.06)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              Aktivasi Massal
            </Badge>
            <h2 className="mt-3 text-xl font-black text-slate-950">
              Buat Akun Login Siswa
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Pilih siswa yang belum memiliki akun. Sistem membuat email otomatis dari
              nama/NIS dan password awal yang hanya ditampilkan sekali.
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-700">
            {selectedIds.length} dipilih
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            <Label>Domain email siswa</Label>
            <Input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="contoh: siswa.sekolah.sch.id"
              className="rounded-2xl"
            />
            <p className="text-xs leading-5 text-slate-500">
              Isi domain saja, tanpa @. Contoh:{" "}
              <span className="font-semibold text-slate-700">siswa.sekolah.sch.id</span>
              {" "}→ hasil email seperti <span className="font-mono">nama.nis@siswa.sekolah.sch.id</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Button onClick={activateBulk} disabled={loading || !canSubmit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Buat Akun Terpilih
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectedIds(students.map((student) => student.id).slice(0, 50))}
              disabled={loading}
            >
              Pilih Maks. 50
            </Button>
            <Button variant="ghost" onClick={() => setSelectedIds([])} disabled={loading}>
              Kosongkan
            </Button>
          </div>
        </div>

        <div className="grid max-h-72 gap-2 overflow-y-auto rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 md:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <label
              key={student.id}
              className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3 text-sm shadow-sm"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(student.id)}
                onChange={() => toggleStudent(student.id)}
                className="mt-1 h-4 w-4 rounded border-emerald-200 text-emerald-600"
              />
              <span className="min-w-0">
                <span className="block truncate font-extrabold text-slate-950">
                  {student.name}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {student.className} {student.nis ? `· NIS ${student.nis}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>

        {message ? (
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              message.tone === "success"
                ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                : "border border-red-100 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {credentials.length > 0 ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-extrabold text-amber-950">
                  Simpan kredensial sebelum halaman ditutup
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Password hanya ditampilkan pada hasil aktivasi ini.
                </p>
              </div>
              <Button variant="outline" className="bg-white" onClick={copyCredentials}>
                <Copy className="h-4 w-4" />
                Salin Semua
              </Button>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {credentials.map((item) => (
                <div key={item.studentId} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-extrabold text-slate-950">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.className}</p>
                  <p className="mt-2 font-mono text-xs text-emerald-700">{item.email}</p>
                  <p className="mt-1 font-mono text-xs text-slate-700">{item.password}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">
          <UsersRound className="h-4 w-4" />
          Aktivasi massal dibatasi maksimal 50 siswa per proses agar aman dan mudah
          dicek ulang.
        </div>
      </CardContent>
    </Card>
  );
}
