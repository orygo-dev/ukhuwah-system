import assert from "node:assert/strict";
import test from "node:test";
import { fetchReadingJson } from "../../src/lib/reading-request";

test("reading request aborts a server request that never completes", async () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });

  try {
    const hangingFetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      })) as typeof fetch;

    await assert.rejects(
      fetchReadingJson("/api/reading/upload", { method: "POST" }, {
        timeoutMs: 10,
        fetchImpl: hangingFetch,
      }),
      /Server tidak merespons dalam batas waktu/,
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("reading request turns a non-JSON 413 response into a useful message", async () => {
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });

  try {
    const rejectedFetch = (async () =>
      new Response("Payload Too Large", { status: 413 })) as typeof fetch;
    await assert.rejects(
      fetchReadingJson("/api/reading/upload", { method: "POST" }, {
        fetchImpl: rejectedFetch,
      }),
      /Ukuran file melebihi batas upload server/,
    );
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
