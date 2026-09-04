import assert from "node:assert/strict";
import test from "node:test";
import { encode, getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import {
  findAuthSessionCookieName,
} from "../src/lib/auth-session-cookie";
import proxy from "../src/proxy";

const secret = "auth-session-cookie-regression-secret";

test("production secure Auth.js cookie is selected and decrypted", async () => {
  const cookieName = "__Secure-authjs.session-token";
  const jwt = await encode({
    secret,
    salt: cookieName,
    token: { sub: "demo-user", role: "TEACHER" },
  });
  const request = new NextRequest("https://guruspaceai.cloud/dashboard", {
    headers: { cookie: `${cookieName}=${jwt}` },
  });

  // Auth.js getToken defaults to the non-secure cookie name when the caller
  // does not tell it which HTTPS cookie was actually issued.
  assert.equal(await getToken({ req: request, secret }), null);

  const resolvedName = findAuthSessionCookieName(
    request.cookies.getAll().map((cookie) => cookie.name)
  );
  assert.equal(resolvedName, cookieName);

  const token = await getToken({
    req: request,
    secret,
    cookieName: resolvedName!,
    salt: resolvedName!,
  });
  assert.equal(token?.sub, "demo-user");
  assert.equal(token?.role, "TEACHER");

  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    const proxyResponse = await proxy(request);
    assert.equal(proxyResponse.status, 200);
    assert.equal(proxyResponse.headers.get("location"), null);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("chunked secure cookies resolve to their Auth.js base name", () => {
  assert.equal(
    findAuthSessionCookieName([
      "__Secure-authjs.session-token.0",
      "__Secure-authjs.session-token.1",
    ]),
    "__Secure-authjs.session-token"
  );
});

test("unrelated cookies are never treated as an authenticated session", () => {
  assert.equal(findAuthSessionCookieName(["theme", "gs-partner-session"]), null);
});
