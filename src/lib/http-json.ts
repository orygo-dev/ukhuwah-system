/**
 * Safe JSON helpers for fetch/Request bodies.
 * Avoids Firefox "JSON.parse: unexpected end of data" on empty/non-JSON responses.
 */

/** Default shape for API JSON responses (error/reason are common). */
export type ApiJson = {
  error?: string;
  reason?: string;
};

export function apiError(data: ApiJson, fallback: string): string {
  return typeof data.error === "string" && data.error.trim() ? data.error : fallback;
}

/** Read API JSON safely. Pass T when the endpoint has a known response shape. */
export async function readResponseJson<T extends object = Record<string, unknown>>(
  response: Response,
  fallbackError = "Respons server tidak valid."
): Promise<T & ApiJson> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "Respons kosong dari server."
        : `${fallbackError} (HTTP ${response.status}).`
    );
  }
  try {
    return JSON.parse(text) as T & ApiJson;
  } catch {
    throw new Error(
      response.ok
        ? "Respons server bukan JSON valid."
        : `${fallbackError} (HTTP ${response.status}).`
    );
  }
}

export async function readRequestJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
