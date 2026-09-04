import React from "react";
import { cn } from "@/lib/utils";
import { sanitizeDocumentContent } from "@/lib/document-format";

/**
 * Lightweight, dependency-free Markdown renderer.
 * Supports headings, bold/italic/inline-code, ordered & unordered lists,
 * tables (GFM), blockquotes, horizontal rules, and paragraphs.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b2-${i}`}>{match[3]}</strong>);
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] !== undefined) {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{match[5]}</em>);
    }
    lastIndex = match.index + match[0].length;
    i++;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

export function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const lines = sanitizeDocumentContent(content).replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (trimmed === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key++} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const inline = renderInline(text, `h${key}`);
      const headingKey = key++;
      if (level === 1) {
        blocks.push(<h1 key={headingKey} className="mb-3 mt-6 text-2xl font-bold first:mt-0">{inline}</h1>);
      } else if (level === 2) {
        blocks.push(<h2 key={headingKey} className="mb-2.5 mt-5 text-xl font-bold first:mt-0">{inline}</h2>);
      } else if (level === 3) {
        blocks.push(<h3 key={headingKey} className="mb-2 mt-4 text-lg font-semibold first:mt-0">{inline}</h3>);
      } else if (level === 4) {
        blocks.push(<h4 key={headingKey} className="mb-1.5 mt-3 text-base font-semibold">{inline}</h4>);
      } else if (level === 5) {
        blocks.push(<h5 key={headingKey} className="mb-1 mt-2 text-sm font-semibold">{inline}</h5>);
      } else {
        blocks.push(<h6 key={headingKey} className="mb-1 mt-2 text-sm font-medium">{inline}</h6>);
      }
      i++;
      continue;
    }

    // Table
    if (
      trimmed.startsWith("|") &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const header = splitTableRow(trimmed);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[j]));
        j++;
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/60">
                {header.map((cell, ci) => (
                  <th
                    key={ci}
                    className="border border-border px-3 py-2 text-left font-semibold"
                  >
                    {renderInline(cell, `th-${key}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="even:bg-muted/20">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="border border-border px-3 py-2 align-top"
                    >
                      {renderInline(cell, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-4 border-primary/40 bg-muted/30 px-4 py-2 italic text-muted-foreground"
        >
          {renderInline(quoteLines.join(" "), `bq-${key}`)}
        </blockquote>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-2 ml-5 list-decimal space-y-1">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ol-${key}-${ii}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 ml-5 list-disc space-y-1">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it, `ul-${key}-${ii}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !lines[i].trim().startsWith("|") &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(
        <p key={key++} className="my-2 leading-relaxed">
          {paraLines.flatMap((pl, pi) => {
            const rendered = renderInline(pl, `p-${key}-${pi}`);
            return pi < paraLines.length - 1
              ? [...rendered, <br key={`br-${key}-${pi}`} />]
              : rendered;
          })}
        </p>
      );
    }
  }

  return (
    <div className={cn("text-sm text-foreground", className)}>{blocks}</div>
  );
}
