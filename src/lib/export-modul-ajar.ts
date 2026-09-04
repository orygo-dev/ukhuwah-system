import {
  composeModulAjarMarkdown,
  getModulAjarTitle,
} from "@/lib/templates/modul-ajar";
import { exportToDocx, exportToPdf } from "@/lib/export";

export async function exportModulAjarDocx(
  content: string,
  input?: Record<string, unknown> | null
): Promise<Buffer> {
  const normalized = composeModulAjarMarkdown(content, input);
  return exportToDocx(getModulAjarTitle(input), normalized);
}

export async function exportModulAjarPdf(
  content: string,
  input?: Record<string, unknown> | null
): Promise<Buffer> {
  const normalized = composeModulAjarMarkdown(content, input);
  return exportToPdf(getModulAjarTitle(input), normalized);
}
