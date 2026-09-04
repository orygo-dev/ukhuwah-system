"use client";

export type RenderedPdfCover = {
  file: File;
  pageCount: number;
  pageNumber: number;
};

export function clampPdfPage(pageNumber: number, pageCount: number) {
  if (!Number.isFinite(pageNumber)) return 1;
  return Math.min(Math.max(Math.trunc(pageNumber), 1), Math.max(pageCount, 1));
}

export async function renderPdfPageAsCover(
  source: File,
  requestedPage: number,
): Promise<RenderedPdfCover> {
  const pdfjs = await import("pdfjs-dist/webpack.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await source.arrayBuffer()),
  });

  try {
    const document = await loadingTask.promise;
    const pageNumber = clampPdfPage(requestedPage, document.numPages);
    const page = await document.getPage(pageNumber);
    const naturalViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1200 / Math.max(naturalViewport.width, 1));
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Browser tidak dapat menyiapkan pratinjau sampul.");

    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("Halaman ebook gagal diubah menjadi sampul.")),
        "image/webp",
        0.88,
      );
    });
    canvas.width = 0;
    canvas.height = 0;

    return {
      file: new File([blob], `sampul-halaman-${pageNumber}.webp`, {
        type: "image/webp",
      }),
      pageCount: document.numPages,
      pageNumber,
    };
  } finally {
    await loadingTask.destroy();
  }
}
