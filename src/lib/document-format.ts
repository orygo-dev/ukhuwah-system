/**
 * Document formatting utilities for Navalogi.
 * Converts AI markdown into clean, print-ready administrative documents.
 */

export type DocBlock =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "blockquote"; text: string };

const CHAT_PREFIX_PATTERNS = [
  /^(tentu|baik|oke|sure|of course|absolutely)[!.,]?\s*/i,
  /^(berikut|di bawah ini|silakan lihat|berikut ini)[\s:,-]*/i,
  /^(here is|here's|below is)[\s:,-]*/i,
  /^saya (akan |telah )?(membuat|menyusun|menyiapkan)[\s:,-]*/i,
];

const CHAT_SUFFIX_PATTERNS = [
  /semoga (dokumen|bermanfaat|membantu).*$/i,
  /jika (ada|Anda).*pertanyaan.*$/i,
  /silakan (sesuaikan|hubungi|tanyakan).*$/i,
];

/** Strip conversational AI wrapper; keep only document body. */
export function sanitizeDocumentContent(raw: string): string {
  let text = raw.trim();

  // Unwrap ```markdown ... ``` or ``` ... ```
  const fence = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```\s*$/i.exec(text);
  if (fence) text = fence[1].trim();

  const lines = text.split("\n");
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("#")) {
      start = i;
      break;
    }
    if (t.length > 0 && !/^[-*]|^\d+\./.test(t)) {
      let cleaned = t;
      for (const p of CHAT_PREFIX_PATTERNS) {
        cleaned = cleaned.replace(p, "").trim();
      }
      if (cleaned.startsWith("#")) {
        lines[i] = cleaned;
        start = i;
        break;
      }
    }
  }

  let result = lines.slice(start).join("\n").trim();

  // Remove trailing chat lines
  const outLines = result.split("\n");
  while (outLines.length > 0) {
    const last = outLines[outLines.length - 1].trim();
    if (!last) {
      outLines.pop();
      continue;
    }
    if (CHAT_SUFFIX_PATTERNS.some((p) => p.test(last))) {
      outLines.pop();
      continue;
    }
    break;
  }
  result = outLines.join("\n");

  // Replace lazy placeholders
  result = result.replace(/^[.\-…]{2,}\s*$/gm, "");
  result = result.replace(/\(isi (di sini|sesuai kebutuhan|belum diisi)\)/gi, "");

  return result.trim();
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

function stripInlineMd(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/** Parse sanitized markdown into structured blocks for export. */
export function parseMarkdownBlocks(content: string): DocBlock[] {
  const lines = sanitizeDocumentContent(content).replace(/\r\n/g, "\n").split("\n");
  const blocks: DocBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3 | 4;
      blocks.push({
        type: `h${level}` as "h1" | "h2" | "h3" | "h4",
        text: stripInlineMd(heading[2]),
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(trimmed).map(stripInlineMd);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        rows.push(splitTableRow(lines[j]).map(stripInlineMd));
        j++;
      }
      blocks.push({ type: "table", headers, rows });
      i = j;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", text: stripInlineMd(quoteLines.join(" ")) });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(stripInlineMd(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        items.push(stripInlineMd(lines[i].trim().replace(/^[-*+]\s+/, "")));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      !lines[i].trim().startsWith(">") &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "p", text: stripInlineMd(paraLines.join(" ")) });
    }
  }

  return blocks;
}

/** Split inline **bold** segments for DOCX TextRun arrays. */
export function parseInlineRuns(
  text: string,
  opts?: { bold?: boolean; size?: number }
): { text: string; bold?: boolean; size?: number }[] {
  const runs: { text: string; bold?: boolean; size?: number }[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) {
      runs.push({ text: text.slice(last, m.index), ...opts });
    }
    runs.push({ text: m[1], bold: true, ...opts });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), ...opts });
  if (runs.length === 0) runs.push({ text, ...opts });
  return runs;
}

export const DOCUMENT_OUTPUT_RULES = `
ATURAN OUTPUT WAJIB (PENTING):
- Anda adalah mesin pembuat dokumen administrasi guru profesional, BUKAN chatbot.
- Output HANYA isi dokumen resmi. DILARANG: sapaan, "Berikut adalah...", "Tentu", "Silakan", "Semoga membantu", atau penjelasan di luar dokumen.
- Langsung mulai baris pertama dengan heading # judul dokumen.
- Isi SETIAP bagian dengan konten konkret, mendalam, dan spesifik — DILARANG placeholder "...", "(isi di sini)", tabel kosong, atau bagian diringkas.
- Bahasa Indonesia formal baku administrasi sekolah Indonesia.
- Dokumen harus selengkap modul ajar profesional siap cetak — minimal 3.000 kata untuk modul ajar.
- Gunakan tabel Markdown untuk identitas, kegiatan (Guru/Siswa/Waktu), ATP, asesmen, rubrik, LKPD, dan glosarium.
- Kegiatan pembelajaran harus operasional: guru bisa langsung mengajar tanpa menambah rencana baru.
`.trim();
