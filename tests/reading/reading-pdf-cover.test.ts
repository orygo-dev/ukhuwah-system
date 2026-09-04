import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { clampPdfPage } from "../../src/lib/reading-pdf-cover";

test("ebook cover page is clamped to the available PDF range", () => {
  assert.equal(clampPdfPage(0, 12), 1);
  assert.equal(clampPdfPage(4.9, 12), 4);
  assert.equal(clampPdfPage(99, 12), 12);
  assert.equal(clampPdfPage(Number.NaN, 12), 1);
});

test("global reading form offers ebook-page, upload, and no-cover modes", () => {
  const source = readFileSync(
    "src/components/reading/reading-management-client.tsx",
    "utf8",
  );

  assert.match(source, /Gunakan halaman ebook/);
  assert.match(source, /Pilih halaman ebook untuk sampul/);
  assert.match(source, /Pilih nomor halaman sampul/);
  assert.match(source, /Gunakan halaman ini sebagai sampul/);
  assert.match(source, /Unggah gambar/);
  assert.match(source, /Tanpa sampul/);
  assert.match(source, /renderPdfPageAsCover/);
  assert.match(source, /Mengunggah sampul/);
  assert.match(source, /Mengunggah file PDF/);
  assert.match(source, /Menyimpan data bacaan/);
  assert.match(source, /fetchReadingJson/);
  assert.match(source, /READING_PDF_MAX_MB/);
  assert.match(source, /readingPdfSizeError/);
  assert.match(source, /type="hidden" name="scope" value="GLOBAL"/);
});
