"use client";

import { Download, Filter } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ProvinceDashboardToolbar({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 shadow-sm">
        <Filter className="h-4 w-4 text-emerald-600" />
        <span className="sr-only sm:not-sr-only">Periode</span>
        <select
          aria-label="Periode pemantauan"
          value={period}
          disabled={isPending}
          onChange={(event) => {
            const value = event.target.value;
            const params = new URLSearchParams(searchParams.toString());
            params.set("period", value);
            startTransition(() => router.push(`${pathname}?${params.toString()}`));
          }}
          className="bg-transparent text-sm font-extrabold text-slate-900 outline-none"
        >
          <option value="30">30 hari</option>
          <option value="90">90 hari</option>
          <option value="365">1 tahun</option>
        </select>
      </label>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        <Download className="h-4 w-4" />
        Ekspor laporan
      </button>
    </div>
  );
}
