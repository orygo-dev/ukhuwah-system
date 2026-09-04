"use client";

import { useEffect, useState } from "react";
import { Calculator, MapPin, Wallet } from "lucide-react";

const packageOptions = [48000, 75000];
const commissionRate = 5;
const regionExamples = [
  { label: "Kota Banjarmasin", teachers: 7540 },
  { label: "Kota Banjarbaru", teachers: 6712 },
  { label: "Tanah Laut", teachers: 4239 },
];

const formatRupiah = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);

function useAnimatedNumber(value: number) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    const duration = 650;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // display is intentionally captured as the current animation starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

export function CommissionCalculatorDemo() {
  const [teacherCount, setTeacherCount] = useState(7540);
  const [packagePrice, setPackagePrice] = useState(packageOptions[0]);
  const transactionValue = teacherCount * packagePrice;
  const commission = Math.round(transactionValue * (commissionRate / 100));
  const animatedCommission = useAnimatedNumber(commission);
  const animatedTeachers = useAnimatedNumber(teacherCount);

  return (
    <div className="mx-auto max-w-5xl rounded-[24px] border border-emerald-100 bg-white p-4 text-slate-950 shadow-[0_18px_55px_rgba(15,76,129,0.1)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-blue-50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">
              Simulasi komisi mitra
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Geser jumlah guru premium atau pilih estimasi region.
            </p>
          </div>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700">
          Komisi tetap {commissionRate}%
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-950">
                Jumlah guru member premium
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                Estimasi jumlah guru region tahun ajaran 2024/2025.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-2 text-2xl font-black text-emerald-700 shadow-sm">
              {formatNumber(animatedTeachers)}
            </div>
          </div>
          <input
            type="range"
            min={100}
            max={8000}
            step={10}
            value={teacherCount}
            onChange={(event) => setTeacherCount(Number(event.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white accent-blue-600"
            aria-label="Jumlah guru member premium"
          />
          <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-500">
            <span>100 guru</span>
            <span>8.000 guru</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {regionExamples.map((region) => (
              <button
                key={region.label}
                type="button"
                onClick={() => setTeacherCount(region.teachers)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-extrabold transition ${
                  teacherCount === region.teachers
                    ? "border-blue-600 bg-emerald-600 text-white"
                    : "border-emerald-100 bg-white text-emerald-700 hover:border-blue-300 hover:bg-emerald-50"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                {region.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
                  Estimasi komisi
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {formatRupiah(animatedCommission)}
                </p>
              </div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-xs font-bold text-emerald-600">Guru premium</p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {formatNumber(animatedTeachers)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-bold text-slate-500">Harga paket</p>
              <select
                value={packagePrice}
                onChange={(event) => setPackagePrice(Number(event.target.value))}
                className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 outline-none focus:border-blue-400"
                aria-label="Harga paket premium"
              >
                {packageOptions.map((price) => (
                  <option key={price} value={price}>
                    {formatRupiah(price)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-600">Komisi mitra</p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {commissionRate}%
            </p>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Angka di atas hanya contoh simulasi. Nominal final mengikuti paket
            aktif, transaksi valid, relasi mitra, dan ketentuan pencairan di
            portal mitra.
          </p>
        </div>
      </div>
    </div>
  );
}
