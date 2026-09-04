export const AUTH_SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

/**
 * Resolve the base session-cookie name, including Auth.js chunked cookies.
 * The base name must also be used as the JWT salt when decoding the token.
 */
export function findAuthSessionCookieName(
  cookieNames: readonly string[]
): (typeof AUTH_SESSION_COOKIE_NAMES)[number] | null {
  for (const candidate of AUTH_SESSION_COOKIE_NAMES) {
    if (
      cookieNames.some(
        (name) => name === candidate || name.startsWith(`${candidate}.`)
      )
    ) {
      return candidate;
    }
  }
  return null;
}
