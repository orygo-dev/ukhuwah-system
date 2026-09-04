"use client";

import { Markdown } from "@/components/ui/markdown";
import { sanitizeDocumentContent } from "@/lib/document-format";
import { cn } from "@/lib/utils";

type DocumentViewProps = {
  content: string;
  title?: string;
  className?: string;
};

/**
 * Formal administrative document layout — not a chat bubble.
 */
export function DocumentView({ content, title, className }: DocumentViewProps) {
  const body = sanitizeDocumentContent(content);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[210mm] overflow-hidden rounded-sm border border-border bg-white shadow-md",
        className
      )}
    >
      <div className="border-b border-border bg-slate-50 px-6 py-3 text-center print:bg-white">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Dokumen Administrasi Guru
        </p>
        {title && (
          <p className="mt-1 text-sm font-semibold text-foreground">{title}</p>
        )}
      </div>
      <div className="px-8 py-8 md:px-12 md:py-10 print:px-10 print:py-8">
        <Markdown
          content={body}
          className="[&_h1]:mb-4 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-2 [&_h1]:text-center [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:text-sm [&_h4]:font-semibold [&_p]:text-justify [&_p]:leading-relaxed [&_table]:text-xs"
        />
      </div>
    </div>
  );
}
