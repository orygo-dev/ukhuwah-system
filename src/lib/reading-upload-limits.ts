export const READING_PDF_MAX_MB = 90;
export const READING_PDF_MAX_BYTES = READING_PDF_MAX_MB * 1024 * 1024;
export const READING_PDF_CHUNK_BYTES = 5 * 1024 * 1024;

export function readingPdfChunkCount(size: number) {
  return Math.max(1, Math.ceil(size / READING_PDF_CHUNK_BYTES));
}

export function readingPdfSizeError(size: number): string | null {
  if (size <= READING_PDF_MAX_BYTES) return null;
  return `PDF maksimal ${READING_PDF_MAX_MB} MB.`;
}
