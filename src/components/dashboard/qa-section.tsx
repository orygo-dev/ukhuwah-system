import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type QaItem = {
  question: string;
  answer: string;
};

type QaSectionProps = {
  title?: string;
  description?: string;
  items: QaItem[];
  className?: string;
};

export function QaSection({
  title = "Pertanyaan yang Sering Ditanyakan",
  description = "Jawaban singkat untuk membantu pengguna baru memahami alur fitur.",
  items,
  className,
}: QaSectionProps) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-emerald-100 bg-white p-5 shadow-[0_14px_42px_rgba(15,76,129,0.06)]",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-primary">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-5 divide-y divide-blue-50">
        {items.map((item, index) => (
          <details
            key={item.question}
            className="group py-3"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold text-slate-900">
              {item.question}
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-primary transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
