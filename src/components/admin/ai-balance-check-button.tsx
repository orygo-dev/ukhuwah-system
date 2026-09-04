"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AiBalanceCheckButton({ providerId }: { providerId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const checkBalance = async () => {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/ai-usage/balance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal cek saldo provider");
      setMessage(json.message || "Saldo provider berhasil dicek.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal cek saldo provider");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-emerald-100 bg-white"
        onClick={checkBalance}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Cek Saldo
      </Button>
      {message ? <p className="text-xs font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
