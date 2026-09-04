"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SchoolPickerOption = {
  id: string;
  name: string;
  npsn?: string | null;
  city?: string | null;
  provinceName?: string | null;
};

type SchoolSearchPickerProps = {
  schools: SchoolPickerOption[];
  value: string;
  onChange: (schoolId: string) => void;
  disabled?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  className?: string;
};

export function SchoolSearchPicker({
  schools,
  value,
  onChange,
  disabled,
  allowNone = true,
  noneLabel = "Tanpa sekolah",
  placeholder = "Cari nama sekolah, NPSN, kota, atau provinsi...",
  className,
}: SchoolSearchPickerProps) {
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => schools.find((school) => school.id === value) || null,
    [schools, value]
  );

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? schools
      : schools.filter((school) =>
          [school.name, school.npsn, school.city, school.provinceName]
            .filter(Boolean)
            .some((item) => item!.toLowerCase().includes(q))
        );

    // Keep the selected school visible even if it falls outside the preview window.
    const preview = matched.slice(0, q ? 150 : 80);
    if (selected && !preview.some((school) => school.id === selected.id)) {
      return [selected, ...preview];
    }
    return preview;
  }, [query, schools, selected]);

  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools.length;
    return schools.filter((school) =>
      [school.name, school.npsn, school.city, school.provinceName]
        .filter(Boolean)
        .some((item) => item!.toLowerCase().includes(q))
    ).length;
  }, [query, schools]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9"
        />
      </div>

      {selected ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          Terpilih: {selected.name}
          {selected.npsn ? ` · NPSN ${selected.npsn}` : ""}
        </div>
      ) : allowNone ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          Belum memilih sekolah
        </div>
      ) : null}

      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {allowNone ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange("")}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50",
              !value && "bg-emerald-50 font-semibold text-emerald-800"
            )}
          >
            <span>{noneLabel}</span>
            {!value ? <Check className="h-4 w-4" /> : null}
          </button>
        ) : null}

        {options.map((school) => {
          const active = school.id === value;
          return (
            <button
              key={school.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(school.id)}
              className={cn(
                "flex w-full items-start justify-between gap-3 border-t border-slate-100 px-3 py-2.5 text-left text-sm hover:bg-slate-50",
                active && "bg-emerald-50 font-semibold text-emerald-900"
              )}
            >
              <span className="min-w-0">
                <span className="block truncate">{school.name}</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-slate-500">
                  {[school.npsn ? `NPSN ${school.npsn}` : null, school.city, school.provinceName]
                    .filter(Boolean)
                    .join(" · ") || "Wilayah belum lengkap"}
                </span>
              </span>
              {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}

        {options.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-slate-500">
            Sekolah tidak ditemukan. Ubah kata kunci pencarian.
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        {query.trim()
          ? `Menampilkan ${options.length} dari ${totalMatches} hasil pencarian.`
          : `Menampilkan ${Math.min(options.length, 80)} dari ${schools.length} sekolah. Ketik untuk mencari sekolah lain.`}
      </p>
    </div>
  );
}
