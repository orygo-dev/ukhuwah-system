import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  ClipboardCheck,
  Coins,
  CreditCard,
  FileText,
  Gift,
  Handshake,
  MessageCircle,
  NotebookPen,
  School,
  ClipboardList,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type QuickMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: string;
};

const QUICK_MENU_ITEMS: QuickMenuItem[] = [
  {
    href: "/dashboard/kelas",
    label: "Kelas",
    icon: School,
    tone: "bg-emerald-50 text-emerald-700 ring-blue-100",
  },
  {
    href: "/dashboard/jurnal",
    label: "Jurnal",
    icon: NotebookPen,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  {
    href: "/dashboard/absensi",
    label: "Absensi",
    icon: ClipboardCheck,
    tone: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  },
  {
    href: "/dashboard/penilaian",
    label: "Penilaian",
    icon: ClipboardList,
    tone: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  {
    href: "/dashboard/documents",
    label: "Dokumen",
    icon: FileText,
    tone: "bg-slate-50 text-slate-700 ring-slate-100",
  },
  {
    href: "/dashboard/topup",
    label: "Top Up",
    icon: Coins,
    tone: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  {
    href: "/dashboard/billing",
    label: "Langganan",
    icon: CreditCard,
    tone: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
  {
    href: "/dashboard/afiliasi",
    label: "Afiliasi",
    icon: Handshake,
    tone: "bg-rose-50 text-rose-700 ring-rose-100",
  },
  {
    href: "/dashboard/spotlight",
    label: "Zona Kreasi",
    icon: Clapperboard,
    tone: "bg-orange-50 text-orange-700 ring-orange-100",
  },
  {
    href: "/dashboard/pesan",
    label: "Pesan",
    icon: MessageCircle,
    tone: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  {
    href: "/dashboard/member",
    label: "Member",
    icon: UserRound,
    tone: "bg-teal-50 text-teal-700 ring-teal-100",
  },
  {
    href: "/dashboard/reward",
    label: "Kredit Gratis",
    icon: Gift,
    tone: "bg-lime-50 text-lime-700 ring-lime-100",
  },
];

export function DashboardMobileQuickMenu() {
  return (
    <section className="rounded-[1.35rem] border border-emerald-100/80 bg-white p-3 shadow-[0_14px_35px_rgba(15,76,129,0.08)] lg:hidden">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-extrabold text-slate-950">Menu Utama</h2>
        <span className="text-[11px] font-bold text-emerald-600">
          {QUICK_MENU_ITEMS.length} fitur
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {QUICK_MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-2xl px-1 py-2.5",
                "transition-colors active:bg-emerald-50"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
                  item.tone
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="line-clamp-2 text-center text-[10.5px] font-extrabold leading-tight text-slate-800">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
