"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type FormWizardProps = {
  steps: { id: string; label: string; description?: string }[];
  currentStep: number;
  children: React.ReactNode;
};

export function FormWizard({
  steps,
  currentStep,
  children,
  className,
}: FormWizardProps & { className?: string }) {
  return (
    <div className={cn("mx-auto max-w-3xl", className)}>
      {/* Step indicator */}
      <div className="mb-4 sm:mb-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:items-center sm:justify-between sm:overflow-visible sm:pb-0">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <div key={step.id} className="flex shrink-0 items-center sm:flex-1">
                <div
                  className={cn(
                    "flex min-w-[92px] items-center gap-2 rounded-full border px-2.5 py-2 sm:min-w-0 sm:flex-col sm:gap-0 sm:border-0 sm:px-0 sm:py-0",
                    isCurrent
                      ? "border-emerald-200 bg-emerald-50"
                      : isCompleted
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all sm:h-10 sm:w-10 sm:text-sm",
                      isCompleted &&
                        "border-primary bg-primary text-primary-foreground",
                      isCurrent &&
                        "border-primary bg-primary/10 text-primary",
                      !isCompleted &&
                        !isCurrent &&
                        "border-muted bg-background text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "max-w-[74px] truncate text-[11px] font-extrabold sm:mt-2 sm:block sm:max-w-none sm:text-xs sm:font-medium",
                      isCurrent ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 hidden h-0.5 flex-1 sm:block",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="animate-fade-in">{children}</div>
    </div>
  );
}
