import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { Auth, type AuthConfig } from "@auth/core";
import { encode, type JWT } from "@auth/core/jwt";
import ts from "typescript";

// Execute the actual application callbacks, replacing only external services.
// Requests below still use Auth.js' real JWT encryption, session and cookie code.
function fixture() {
  let config: AuthConfig | undefined;
  const account = { authVersion: 0, role: "TEACHER", creditsRemaining: 12 };
  let exists = true;
  let activeStudent = true;
  let databaseError = false;
  let afterRead: (() => void) | undefined;
  const prisma = {
    user: {
      findUnique: async () => {
        if (databaseError) throw new Error("database unavailable (test)");
        const snapshot = exists ? { ...account } : null;
        const hook = afterRead;
        afterRead = undefined;
        hook?.();
        return snapshot;
      },
    },
    student: { findFirst: async () => activeStudent ? { id: "student-test" } : null },
  };
  const dependencies: Record<string, unknown> = {
    "next-auth": (value: AuthConfig) => { config = value; return {}; },
    "next-auth/providers/credentials": (options: unknown) => options,
    bcryptjs: {},
    "@/lib/prisma": { prisma },
    "@/lib/plan-limits": { serializeActiveMembershipPlan: () => null },
    "@/lib/security-rate-limit": {},
  };
  const compiled = ts.transpileModule(fs.readFileSync("src/lib/auth.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "exports", compiled)((id: string) => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, {});
  assert.ok(config?.callbacks?.jwt);
  const callbacks = config.callbacks;
  const secret = "session-regression-test-secret-not-a-real-credential";
  const cookieName = "__Secure-authjs.session-token";
  const validToken = (): JWT => ({ id: "test-user", authVersion: 0, role: "TEACHER", membershipPlan: null });
  async function session(token: JWT, chunked = false) {
    const encrypted = await encode({ secret, salt: cookieName, token });
    const midpoint = Math.floor(encrypted.length / 2);
    const cookie = chunked
      ? `${cookieName}.0=${encrypted.slice(0, midpoint)}; ${cookieName}.1=${encrypted.slice(midpoint)}`
      : `${cookieName}=${encrypted}`;
    return Auth(new Request("https://example.test/api/auth/session", {
      headers: { cookie },
    }), {
      secret, trustHost: true, basePath: "/api/auth", providers: [],
      session: { strategy: "jwt" }, callbacks,
      logger: { error: () => {}, warn: () => {}, debug: () => {} },
    });
  }
  async function update(token: JWT) {
    return callbacks.jwt!({ token, trigger: "update", session: {}, account: null } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);
  }
  async function signIn() {
    return callbacks.jwt!({
      token: {}, user: { id: "test-user", ...account }, trigger: "signIn", account: null,
    } as Parameters<NonNullable<typeof callbacks.jwt>>[0]);
  }
  return {
    account, session, update, signIn, validToken,
    removeUser: () => { exists = false; },
    deactivateStudent: () => { activeStudent = false; },
    failDatabase: () => { databaseError = true; },
    afterNextRead: (hook: () => void) => { afterRead = hook; },
  };
}

async function assertSignedOut(response: Response) {
  assert.equal(response.status, 200);
  assert.equal(await response.json(), null, "session endpoint must not advertise a rejected session");
  assert.match(response.headers.get("set-cookie") ?? "", /__Secure-authjs\.session-token(?:\.\d+)?=;.*Max-Age=0/i);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
}

test("legacy Android cookie returns no session and is expired by Auth.js", async () => {
  const f = fixture();
  const token = f.validToken();
  delete token.authVersion;
  await assertSignedOut(await f.session(token));
});

test("fresh teacher and active student sessions continue to work", async () => {
  const f = fixture();
  const response = await f.session(f.validToken());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.id, "test-user");
  assert.equal(body.user.authVersion, 0);
  assert.match(response.headers.get("set-cookie") ?? "", /__Secure-authjs.session-token=\S+/);
  f.account.role = "STUDENT";
  const student = await f.session({ ...f.validToken(), role: "STUDENT" });
  assert.equal((await student.json()).user.role, "STUDENT");
});

test("password change revokes session endpoint as well as protected APIs", async () => {
  const f = fixture();
  f.account.authVersion = 1;
  await assertSignedOut(await f.session(f.validToken()));
});

test("deleted user and deactivated student cannot restore a mobile session", async () => {
  const f = fixture();
  f.removeUser();
  await assertSignedOut(await f.session(f.validToken()));
  const student = fixture();
  student.account.role = "STUDENT";
  student.deactivateStudent();
  await assertSignedOut(await student.session({ ...student.validToken(), role: "STUDENT" }));
});

test("session update cannot upgrade a revoked token to the new password version", async () => {
  const f = fixture();
  f.account.authVersion = 1;
  assert.equal(await f.update(f.validToken()), null);
});

test("missing membership metadata cannot upgrade a legacy or revoked token", async () => {
  const f = fixture();
  const token = f.validToken();
  delete token.authVersion;
  delete token.membershipPlan;
  await assertSignedOut(await f.session(token));
});

test("parallel old session reads remain rejected after revocation", async () => {
  const f = fixture();
  f.account.authVersion = 1;
  await Promise.all(Array.from({ length: 8 }, async () => {
    await assertSignedOut(await f.session(f.validToken()));
  }));
  assert.equal(f.account.authVersion, 1);
});

test("database failure cannot expose a supposedly valid session", async () => {
  const f = fixture();
  f.failDatabase();
  await assertSignedOut(await f.session(f.validToken()));
});

test("valid session refresh preserves version and updates profile metadata", async () => {
  const f = fixture();
  const token = await f.update(f.validToken());
  assert.equal(token?.authVersion, 0);
  assert.equal(token?.creditsRemaining, 12);
});

test("signing in again issues a usable token with the current password version", async () => {
  const f = fixture();
  f.account.authVersion = 2;
  const token = await f.signIn();
  assert.ok(token);
  assert.equal(token.authVersion, 2);
  assert.equal((await (await f.session(token)).json()).user.authVersion, 2);
});

test("password change racing with refresh cannot revive the old session", async () => {
  const f = fixture();
  f.afterNextRead(() => { f.account.authVersion = 1; });
  const token = await f.update(f.validToken());
  assert.ok(token);
  assert.equal(token.authVersion, 0);
  await assertSignedOut(await f.session(token));
});

test("revoked chunked session expires every stored cookie chunk", async () => {
  const f = fixture();
  f.account.authVersion = 1;
  const response = await f.session(f.validToken(), true);
  await assertSignedOut(response);
  const cookies = response.headers.get("set-cookie") ?? "";
  assert.match(cookies, /session-token\.0=;.*Max-Age=0/i);
  assert.match(cookies, /session-token\.1=;.*Max-Age=0/i);
});
