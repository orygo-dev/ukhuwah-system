"use client";

type FetchImplementation = typeof fetch;

export async function fetchReadingJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options?: {
    timeoutMs?: number;
    fetchImpl?: FetchImplementation;
  },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await (options?.fetchImpl ?? fetch)(input, {
      ...init,
      signal: controller.signal,
    });
    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      const serverMessage = typeof data.error === "string" ? data.error : "";
      if (serverMessage) throw new Error(serverMessage);
      if (response.status === 413) throw new Error("Ukuran file melebihi batas upload server.");
      throw new Error(`Permintaan gagal (${response.status}).`);
    }
    return data as T;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "Server tidak merespons dalam batas waktu. Periksa koneksi atau konfigurasi penyimpanan, lalu coba kembali.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
