import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DashTone = "sky" | "emerald" | "amber" | "rose" | "indigo" | "teal" | "cyan" | "orange";

export const DASH_CARD_TONES: Record<
  DashTone,
  {
    card: string;
    icon: string;
    value: string;
    bar: string;
  }
> = {
  sky: {
    card: "border-sky-200/80 bg-gradient-to-br from-sky-50 to-white hover:border-sky-300",
    icon: "bg-sky-100 text-sky-700 ring-sky-200/70",
    value: "text-sky-950",
    bar: "bg-sky-500",
  },
  emerald: {
    card: "border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white hover:border-emerald-300",
    icon: "bg-emerald-100 text-emerald-700 ring-emerald-200/70",
    value: "text-emerald-950",
    bar: "bg-emerald-500",
  },
  amber: {
    card: "border-amber-200/80 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300",
    icon: "bg-amber-100 text-amber-800 ring-amber-200/70",
    value: "text-amber-950",
    bar: "bg-amber-500",
  },
  rose: {
    card: "border-rose-200/80 bg-gradient-to-br from-rose-50 to-white hover:border-rose-300",
    icon: "bg-rose-100 text-rose-700 ring-rose-200/70",
    value: "text-rose-950",
    bar: "bg-rose-500",
  },
  indigo: {
    card: "border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white hover:border-indigo-300",
    icon: "bg-indigo-100 text-indigo-700 ring-indigo-200/70",
    value: "text-indigo-950",
    bar: "bg-indigo-500",
  },
  teal: {
    card: "border-teal-200/80 bg-gradient-to-br from-teal-50 to-white hover:border-teal-300",
    icon: "bg-teal-100 text-teal-700 ring-teal-200/70",
    value: "text-teal-950",
    bar: "bg-teal-500",
  },
  cyan: {
    card: "border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-white hover:border-cyan-300",
    icon: "bg-cyan-100 text-cyan-700 ring-cyan-200/70",
    value: "text-cyan-950",
    bar: "bg-cyan-500",
  },
  orange: {
    card: "border-orange-200/80 bg-gradient-to-br from-orange-50 to-white hover:border-orange-300",
    icon: "bg-orange-100 text-orange-700 ring-orange-200/70",
    value: "text-orange-950",
    bar: "bg-orange-500",
  },
};

export function DashProgress({
  value,
  tone = "bg-slate-900",
}: {
  value: number;
  tone?: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${safe}%` }} />
    </div>
  );
}

export function DashKpiCard({
  label,
  value,
  helper,
  href,
  icon: Icon,
  tone = "sky",
}: {
  label: string;
  value: string;
  helper: string;
  href?: string;
  icon: LucideIcon;
  tone?: DashTone;
}) {
  const palette = DASH_CARD_TONES[tone];
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)]",
        palette.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        <div className={cn("grid size-9 place-items-center rounded-xl ring-1", palette.icon)}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className={cn("mt-4 text-[1.75rem] font-semibold tracking-tight tabular-nums", palette.value)}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{helper}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-700 opacity-0 transition group-hover:opacity-100">
          Lihat detail <ArrowUpRight className="size-3.5" />
        </span>
      ) : null}
    </div>
  );

  if (!href) return body;
  return (
    <Link
      href={href}
      className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      {body}
    </Link>
  );
}

export function DashPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

export function DashProgramCard({
  title,
  value,
  helper,
  href,
  progress,
  empty,
  tone = "sky",
}: {
  title: string;
  value: string;
  helper: string;
  href: string;
  progress: number;
  empty?: boolean;
  tone?: DashTone;
}) {
  const palette = DASH_CARD_TONES[tone];
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        palette.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-600">{title}</p>
        <ArrowRight className="size-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
      </div>
      <p
        className={cn(
          "mt-4 text-[1.65rem] font-semibold tracking-tight tabular-nums",
          empty ? "text-slate-400" : palette.value
        )}
      >
        {value}
      </p>
      <p className="mt-2 min-h-[40px] text-sm leading-5 text-slate-600">{helper}</p>
      <div className="mt-5">
        <DashProgress value={empty ? 0 : progress} tone={empty ? "bg-slate-300" : palette.bar} />
      </div>
    </Link>
  );
}

export function DashPriorityRow({
  level,
  title,
  helper,
  count,
  href,
}: {
  level: string;
  title: string;
  helper: string;
  count: string;
  href: string;
}) {
  const tone =
    level === "Kritis"
      ? "bg-rose-50 text-rose-700"
      : level === "Tinggi"
        ? "bg-amber-50 text-amber-800"
        : level === "Sedang"
          ? "bg-sky-50 text-sky-700"
          : "bg-emerald-50 text-emerald-700";

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl px-3 py-3 transition hover:bg-slate-50"
    >
      <span className={cn("mt-0.5 rounded-md px-2 py-1 text-[11px] font-semibold", tone)}>
        {level}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{helper}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-900">{count}</span>
        <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
      </div>
    </Link>
  );
}

export function DashDistribution({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: string;
}) {
  const share = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-600">{label}</span>
        <span className="tabular-nums font-semibold text-slate-900">
          {new Intl.NumberFormat("id-ID").format(value)} · {share}%
        </span>
      </div>
      <DashProgress value={share} tone={tone} />
    </div>
  );
}
