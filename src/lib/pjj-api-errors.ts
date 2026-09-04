import { z } from "zod";

export type PjjApiErrorCode = "VALIDATION" | "RECOVERABLE" | "DEGRADED" | "FATAL";

export type PjjApiErrorDescriptor = {
  status: number;
  body: { error: string; code: PjjApiErrorCode; retryable: boolean };
  diagnostic: { name: string; reason: string };
};

const SECRET_PATTERN =
  /(eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|api[_-]?secret|authorization|cookie|token)/i;

function safeDiagnosticReason(value: unknown) {
  const text =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.name
        : String(value ?? "unknown");
  return SECRET_PATTERN.test(text) ? "redacted" : text.slice(0, 96);
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code ?? "");
}

export function classifyPjjApiError(
  error: unknown,
  {
    validationMessage,
    fallbackMessage,
  }: { validationMessage: string; fallbackMessage: string }
): PjjApiErrorDescriptor {
  const name = error instanceof Error ? error.name : "UnknownError";
  const reason = safeDiagnosticReason(error instanceof Error ? error.message : "unknown");
  if (error instanceof z.ZodError || name === "SyntaxError") {
    return {
      status: 422,
      body: { error: validationMessage, code: "VALIDATION", retryable: false },
      diagnostic: { name, reason },
    };
  }

  const code = errorCode(error);
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  // Surface schema drift clearly (e.g. missing can_publish_media / room_mode).
  if (code === "P2022" || /does not exist in the current database/i.test(message)) {
    const column =
      message.match(/column [`']?[\w.]*?([a-z0-9_]+)[`']? does not exist/i)?.[1] ||
      "unknown";
    return {
      status: 503,
      body: {
        error: `Database belum lengkap (kolom hilang: ${column}). Jalankan migrasi PJJ di server.`,
        code: "RECOVERABLE",
        retryable: false,
      },
      diagnostic: { name, reason },
    };
  }

  if (
    /LiveKit belum aktif|belum lengkap|decrypt|Unsupported state|auth tag/i.test(message)
  ) {
    return {
      status: 503,
      body: {
        error:
          message.includes("LiveKit") || /belum aktif|belum lengkap/i.test(message)
            ? "Integrasi LiveKit belum aktif atau belum lengkap. Cek Admin → LiveKit."
            : "Kunci enkripsi LiveKit tidak valid. Simpan ulang API Key/Secret di Admin → LiveKit.",
        code: "RECOVERABLE",
        retryable: false,
      },
      diagnostic: { name, reason },
    };
  }

  if (/^P10(0[0-9]|1[0-7])$/.test(code) || /ECONN|timeout|timed out|unavailable/i.test(reason)) {
    return {
      status: 503,
      body: {
        error: "Layanan sementara tidak tersedia. Silakan coba lagi.",
        code: "RECOVERABLE",
        retryable: true,
      },
      diagnostic: { name, reason },
    };
  }
  if (/livekit|room service|participant service|twirp/i.test(`${name} ${reason}`)) {
    return {
      status: 502,
      body: {
        error: "Layanan kelas langsung sedang terganggu. Silakan coba lagi.",
        code: "DEGRADED",
        retryable: true,
      },
      diagnostic: { name, reason },
    };
  }
  return {
    status: 500,
    body: { error: fallbackMessage, code: "FATAL", retryable: false },
    diagnostic: { name, reason },
  };
}

export function reportPjjApiError(
  scope: string,
  error: unknown,
  messages: { validationMessage: string; fallbackMessage: string }
) {
  const descriptor = classifyPjjApiError(error, messages);
  console.error(
    JSON.stringify({
      event: "pjj.api.error",
      scope,
      code: descriptor.body.code,
      retryable: descriptor.body.retryable,
      ...descriptor.diagnostic,
    })
  );
  return descriptor;
}
