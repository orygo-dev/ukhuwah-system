"use client";

import { Markdown } from "@/components/ui/markdown";
import {
  composeModulAjarMarkdown,
  getModulAjarTitle,
} from "@/lib/templates/modul-ajar";
import { cn } from "@/lib/utils";

type ModulAjarDocumentViewProps = {
  content: string;
  inputData?: Record<string, string>;
  className?: string;
};

export function ModulAjarDocumentView({
  content,
  inputData,
  className,
}: ModulAjarDocumentViewProps) {
  const normalizedContent = composeModulAjarMarkdown(content, inputData);
  const title = getModulAjarTitle(inputData);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[210mm] overflow-hidden rounded-sm border border-border bg-white shadow-md",
        className
      )}
    >
      <div className="border-b border-border bg-slate-50 px-6 py-4 text-center">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Template Resmi - Modul Ajar 21 Bagian
        </p>
        <h1 className="mt-2 text-lg font-bold uppercase tracking-tight">
          {title}
        </h1>
      </div>

      <div className="px-8 py-6 md:px-12 md:py-8">
        <Markdown
          content={normalizedContent}
          className="prose prose-slate max-w-none text-sm leading-relaxed [&_h1]:text-center [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:uppercase [&_h2]:mt-8 [&_h2]:border-b [&_h2]:pb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:uppercase [&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_table]:my-4"
        />
      </div>
    </div>
  );
}
