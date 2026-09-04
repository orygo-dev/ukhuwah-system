import assert from "node:assert/strict";
import test from "node:test";
import {
  READING_PDF_CHUNK_BYTES,
  READING_PDF_MAX_BYTES,
  READING_PDF_MAX_MB,
  readingPdfChunkCount,
  readingPdfSizeError,
} from "../../src/lib/reading-upload-limits";

test("reading PDFs up to 90 MB are accepted", () => {
  assert.equal(READING_PDF_MAX_MB, 90);
  assert.equal(readingPdfSizeError(25 * 1024 * 1024 + 1), null);
  assert.equal(readingPdfSizeError(READING_PDF_MAX_BYTES), null);
});

test("reading PDFs over 90 MB are rejected before upload", () => {
  assert.equal(
    readingPdfSizeError(READING_PDF_MAX_BYTES + 1),
    "PDF maksimal 90 MB.",
  );
});

test("large reading PDFs are split into Cloudflare-safe 5 MB requests", () => {
  assert.equal(READING_PDF_CHUNK_BYTES, 5 * 1024 * 1024);
  assert.equal(readingPdfChunkCount(READING_PDF_CHUNK_BYTES), 1);
  assert.equal(readingPdfChunkCount(READING_PDF_CHUNK_BYTES + 1), 2);
  assert.equal(readingPdfChunkCount(90 * 1024 * 1024), 18);
});
