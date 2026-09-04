import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, DatabaseZap } from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DASH_CARD_TONES,
  type DashTone,
} from "@/components/province/province-dashboard-ui";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("id-ID");

const METRIC_TONE_CYCLE: DashTone[] = ["sky", "emerald", "cyan", "amber", "indigo", "rose", "teal", "orange"];

export function formatProvinceNumber(value: number) {
  return numberFormatter.format(value);
}

export function provincePercent(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function ProvincePageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function ProvinceMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "sky",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: DashTone;
}) {
  const palette = DASH_CARD_TONES[tone];
  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        palette.card
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-slate-600">{label}</p>
        <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1", palette.icon)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className={cn("mt-4 text-[1.75rem] font-semibold tracking-tight tabular-nums", palette.value)}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{helper}</p>
    </div>
  );
}

export function ProvinceMetricStrip({ children }: { children: ReactNode }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const element = child as ReactElement<{ tone?: DashTone }>;
        return cloneElement(element, {
          tone: element.props.tone ?? METRIC_TONE_CYCLE[index % METRIC_TONE_CYCLE.length],
        });
      })}
    </section>
  );
}

export function ProvinceSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      <CardHeader className="border-b border-slate-100 px-6 py-5">
        <CardTitle className="text-base font-semibold tracking-tight text-slate-900">{title}</CardTitle>
        {description ? (
          <CardDescription className="mt-1 text-sm leading-5 text-slate-500">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

export function ProvinceProgress({
  value,
  tone = "bg-slate-900",
}: {
  value: number;
  tone?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${safeValue}%`}>
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function ProvinceEmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 sm:flex-row sm:items-center">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200">
        <DatabaseZap className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
      {href && action ? (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-950"
        >
          {action}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
