import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  parseInlineRuns,
  parseMarkdownBlocks,
  type DocBlock,
} from "@/lib/document-format";

function runsToTextRuns(
  text: string,
  base?: { size?: number; bold?: boolean }
): TextRun[] {
  return parseInlineRuns(text, base).map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold ?? base?.bold,
        size: r.size ?? base?.size,
        font: "Calibri",
      })
  );
}

function headingLevel(type: DocBlock["type"]): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  switch (type) {
    case "h1":
      return HeadingLevel.HEADING_1;
    case "h2":
      return HeadingLevel.HEADING_2;
    case "h3":
      return HeadingLevel.HEADING_3;
    case "h4":
      return HeadingLevel.HEADING_4;
    default:
      return undefined;
  }
}

function blockToDocx(block: DocBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
      return [
        new Paragraph({
          heading: headingLevel(block.type),
          spacing: { before: block.type === "h1" ? 0 : 240, after: 120 },
          children: runsToTextRuns(block.text, {
            bold: true,
            size: block.type === "h1" ? 32 : block.type === "h2" ? 28 : 24,
          }),
        }),
      ];
    case "p":
      return [
        new Paragraph({
          spacing: { after: 160, line: 276 },
          alignment: AlignmentType.JUSTIFIED,
          children: runsToTextRuns(block.text, { size: 22 }),
        }),
      ];
    case "ul":
      return block.items.map(
        (item) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 80 },
            children: runsToTextRuns(item, { size: 22 }),
          })
      );
    case "ol":
      return block.items.map(
        (item, idx) =>
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({ text: `${idx + 1}. `, size: 22, font: "Calibri" }),
              ...runsToTextRuns(item, { size: 22 }),
            ],
          })
      );
    case "blockquote":
      return [
        new Paragraph({
          indent: { left: 720 },
          spacing: { before: 120, after: 120 },
          children: runsToTextRuns(block.text, { size: 22, bold: false }),
        }),
      ];
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 200, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" } },
          children: [new TextRun("")],
        }),
      ];
    case "table": {
      const colCount = Math.max(block.headers.length, 1);
      const widthPct = Math.floor(100 / colCount);
      const border = {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "333333",
      };
      const cell = (text: string, header = false) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: runsToTextRuns(text, { size: 20, bold: header }),
            }),
          ],
        });
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: block.headers.map((h) => cell(h, true)),
            }),
            ...block.rows.map(
              (row) =>
                new TableRow({
                  children: row.map((c) => cell(c)),
                })
            ),
          ],
          borders: {
            top: border,
            bottom: border,
            left: border,
            right: border,
            insideHorizontal: border,
            insideVertical: border,
          },
        }),
        new Paragraph({ children: [new TextRun("")], spacing: { after: 200 } }),
      ];
    }
    default:
      return [];
  }
}

export async function exportToDocx(title: string, content: string): Promise<Buffer> {
  const blocks = parseMarkdownBlocks(content);
  const children: (Paragraph | Table)[] = [];

  // Title page header only if content doesn't start with h1
  const startsWithH1 = blocks[0]?.type === "h1";
  if (!startsWithH1) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({ text: title, bold: true, size: 36, font: "Calibri" }),
        ],
      })
    );
  }

  for (const block of blocks) {
    children.push(...blockToDocx(block));
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function exportToPdf(title: string, content: string): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginL = 20;
  const marginR = 20;
  const marginT = 20;
  const marginB = 20;
  const maxW = pageW - marginL - marginR;
  let y = marginT;

  const blocks = parseMarkdownBlocks(content);
  const startsWithH1 = blocks[0]?.type === "h1";

  const ensureSpace = (need: number) => {
    if (y + need > pageH - marginB) {
      doc.addPage();
      y = marginT;
    }
  };

  const writeLines = (lines: string[], fontSize: number, lineH: number, bold = false) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, marginL, y);
      y += lineH;
    }
  };

  if (!startsWithH1) {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(title, maxW) as string[];
    writeLines(titleLines, 16, 8, true);
    y += 4;
  }

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
        y += 4;
        writeLines(doc.splitTextToSize(block.text, maxW) as string[], 16, 7, true);
        y += 2;
        doc.setLineWidth(0.4);
        doc.line(marginL, y, pageW - marginR, y);
        y += 5;
        break;
      case "h2":
        y += 3;
        writeLines(doc.splitTextToSize(block.text, maxW) as string[], 13, 6, true);
        y += 2;
        break;
      case "h3":
        y += 2;
        writeLines(doc.splitTextToSize(block.text, maxW) as string[], 11.5, 5.5, true);
        y += 1;
        break;
      case "h4":
        writeLines(doc.splitTextToSize(block.text, maxW) as string[], 11, 5, true);
        break;
      case "p": {
        const lines = doc.splitTextToSize(block.text, maxW) as string[];
        writeLines(lines, 10, 4.8);
        y += 2;
        break;
      }
      case "ul":
        for (const item of block.items) {
          const lines = doc.splitTextToSize(`• ${item}`, maxW - 4) as string[];
          writeLines(lines, 10, 4.8);
        }
        y += 1;
        break;
      case "ol":
        block.items.forEach((item, idx) => {
          const lines = doc.splitTextToSize(`${idx + 1}. ${item}`, maxW - 4) as string[];
          writeLines(lines, 10, 4.8);
        });
        y += 1;
        break;
      case "blockquote": {
        const lines = doc.splitTextToSize(block.text, maxW - 8) as string[];
        doc.setDrawColor(180);
        ensureSpace(lines.length * 5 + 4);
        doc.line(marginL + 2, y - 2, marginL + 2, y + lines.length * 4.8);
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        for (const line of lines) {
          ensureSpace(5);
          doc.text(line, marginL + 6, y);
          y += 4.8;
        }
        y += 2;
        break;
      }
      case "hr":
        ensureSpace(6);
        doc.setLineWidth(0.2);
        doc.line(marginL, y, pageW - marginR, y);
        y += 6;
        break;
      case "table": {
        const cols = block.headers.length || (block.rows[0]?.length ?? 1);
        const colW = maxW / cols;
        const rowH = 7;
        const allRows = [block.headers, ...block.rows];
        for (const [rowIndex, row] of allRows.entries()) {
          ensureSpace(rowH + 4);
          let x = marginL;
          for (let c = 0; c < cols; c++) {
            const cell = row[c] || "";
            doc.setLineWidth(0.15);
            doc.rect(x, y - 5, colW, rowH);
            doc.setFontSize(9);
            doc.setFont("helvetica", rowIndex === 0 ? "bold" : "normal");
            const clipped = cell.length > 40 ? `${cell.slice(0, 37)}...` : cell;
            doc.text(clipped, x + 1.5, y);
            x += colW;
          }
          y += rowH;
        }
        y += 4;
        break;
      }
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
