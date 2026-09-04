"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentAccountActionsProps = {
  studentId: string;
  studentName: string;
  hasAccount: boolean;
  accountEmail?: string | null;
  onChanged?: () => void | Promise<void>;
};

export function StudentAccountActions({
  studentId,
  studentName,
  hasAccount,
  accountEmail,
  onChanged,
}: StudentAccountActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(accountEmail ?? "");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length >= 8;
  const canReset = resetPassword.length >= 8;

  const activate = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/students/${studentId}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, password, name: studentName }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage({
        tone: "error",
        text: data.error || "Gagal mengaktifkan akun siswa",
      });
      return;
    }

    setMessage({ tone: "success", text: "Akun login siswa berhasil dibuat" });
    setEmail(normalizedEmail);
    setOpen(false);
    setPassword("");
    await onChanged?.();
    router.refresh();
  };

  const resetAccountPassword = async () => {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/students/${studentId}/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMessage({
        tone: "error",
        text: data.error || "Gagal mereset password siswa",
      });
      return;
    }

    setMessage({ tone: "success", text: "Password siswa berhasil direset" });
    setResetPassword("");
    setOpen(false);
    await onChanged?.();
    router.refresh();
  };

  if (hasAccount) {
    return (
      <div className="min-w-[230px] space-y-2">
        <div className="space-y-1">
          <Badge className="bg-emerald-600 text-white">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Login aktif
          </Badge>
          {accountEmail ? (
            <p className="max-w-[220px] truncate text-xs text-slate-500">
              {accountEmail}
            </p>
          ) : null}
        </div>
        {!open ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
            onClick={() => {
              setOpen(true);
              setMessage(null);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Password
          </Button>
        ) : (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor={`student-reset-${studentId}`} className="text-xs">
                  Password baru
                </Label>
                <Input
                  id={`student-reset-${studentId}`}
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="h-9 rounded-xl bg-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl"
                  onClick={resetAccountPassword}
                  disabled={loading || !canReset}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    setOpen(false);
                    setResetPassword("");
                    setMessage(null);
                  }}
                  disabled={loading}
                >
                  Batal
                </Button>
              </div>
            </div>
          </div>
        )}
        {message ? (
          <p
            className={`text-xs font-semibold ${
              message.tone === "success" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-[230px] space-y-2">
      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-emerald-100 bg-white text-emerald-700 hover:bg-emerald-50"
          onClick={() => setOpen(true)}
        >
          <KeyRound className="h-4 w-4" />
          Aktifkan Login
        </Button>
      ) : (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor={`student-email-${studentId}`} className="text-xs">
                Email siswa
              </Label>
              <Input
                id={`student-email-${studentId}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siswa@sekolah.sch.id"
                className="h-9 rounded-xl bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`student-password-${studentId}`} className="text-xs">
                Password awal
              </Label>
              <Input
                id={`student-password-${studentId}`}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="h-9 rounded-xl bg-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={activate}
                disabled={loading || !canSubmit}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setOpen(false);
                  setMessage(null);
                }}
                disabled={loading}
              >
                Batal
              </Button>
            </div>
          </div>
        </div>
      )}
      {message ? (
        <p
          className={`text-xs font-semibold ${
            message.tone === "success" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
