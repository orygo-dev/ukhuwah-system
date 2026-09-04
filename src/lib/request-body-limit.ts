export function requestBodyTooLarge(request: Request, maxBytes: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

export function bodyTooLargeResponse(message: string) {
  return Response.json({ error: message }, { status: 413 });
}
