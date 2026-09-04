/** Ubah respons error API menjadi pesan yang jelas untuk guru/admin. */

type ErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
};

function parseErrorJson(raw: string): ErrorBody | null {
  try {
    return JSON.parse(raw) as ErrorBody;
  } catch {
    return null;
  }
}

export function formatAiProviderError(
  slug: string,
  status: number,
  rawBody: string
): string {
  const body = parseErrorJson(rawBody);
  const msg = (body?.error?.message || body?.message || rawBody).toLowerCase();
  const type = body?.error?.type || "";

  const label =
    slug === "openai"
      ? "OpenAI"
      : slug === "gemini"
        ? "Google Gemini"
        : slug === "openrouter"
          ? "OpenRouter"
          : slug;

  if (
    status === 429 &&
    (msg.includes("quota") ||
      msg.includes("insufficient_quota") ||
      type === "insufficient_quota")
  ) {
    const guidance =
      slug === "gemini"
        ? "Cek Google AI Studio / Gemini API project: pastikan API key berasal dari project yang benar, billing atau kuota API aktif, dan akun memang diizinkan memakai model tersebut."
        : slug === "openrouter"
          ? "Cek dashboard OpenRouter: pastikan API key valid, saldo/credit tersedia, dan model yang dipilih memang aktif untuk akun Anda."
          : "Buka platform.openai.com → Settings → Billing → tambah metode bayar & set limit > $0.";

    const alternative =
      slug === "gemini"
        ? "Alternatif: sementara jadikan provider lain yang valid sebagai provider utama di Pengaturan AI."
        : "Alternatif: jadikan Gemini sebagai provider utama di Pengaturan AI.";

    return (
      `${label}: Akun belum bisa dipakai (HTTP 429 — insufficient_quota). ` +
      `Ini SERING terjadi walau Usage masih $0: billing/kartu kredit belum diaktifkan, ` +
      `atau API key dari project/organisasi yang belum punya saldo. ` +
      `${guidance} ` +
      `${alternative}`
    );
  }

  if (status === 429) {
    return `${label}: Terlalu banyak permintaan (HTTP 429). Coba lagi beberapa menit atau ganti provider utama.`;
  }

  if (status === 401 || msg.includes("invalid api key") || msg.includes("incorrect api key")) {
    return `${label}: API key tidak valid (HTTP ${status}). Periksa dan simpan ulang API key.`;
  }

  if (status === 403) {
    return `${label}: Akses ditolak (HTTP 403). Periksa izin API key dan billing akun.`;
  }

  if (status === 404 || msg.includes("not_found") || msg.includes("not found")) {
    return `${label}: Model tidak ditemukan (HTTP 404). Pilih model lain di Pengaturan AI.`;
  }

  const short = (body?.error?.message || body?.message || rawBody).slice(0, 200);
  return `${label}: Gagal (HTTP ${status}) — ${short}`;
}
