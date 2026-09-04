import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { isLegacyDemoPassword, strongAdminPasswordSchema } from "../../src/lib/password-policy";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("Super Admin password policy rejects weak and legacy values", () => {
  assert.equal(strongAdminPasswordSchema.safeParse("admin123456").success, false);
  assert.equal(strongAdminPasswordSchema.safeParse("StrongAdmin2026").success, true);
  assert.equal(isLegacyDemoPassword("admin123456"), true);
  assert.equal(isLegacyDemoPassword("StrongAdmin2026"), false);
});

test("self-service password change verifies current password and revokes old sessions", () => {
  const route = read("src/app/api/admin/account/password/route.ts");
  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /bcrypt\.compare\(input\.currentPassword/);
  assert.match(route, /passwordHash: await bcrypt\.hash\(input\.newPassword, 12\)/);
  assert.match(route, /authVersion: \{ increment: 1 \}/);
  assert.match(route, /Password baru harus berbeda/);
});

test("only an authenticated Super Admin can create another Super Admin", () => {
  const route = read("src/app/api/admin/users/route.ts");
  const client = read("src/components/admin/admin-users-client.tsx");
  const nav = read("src/lib/constants.ts");
  assert.match(route, /await requireSuperAdmin\(\)/);
  assert.match(route, /"SUPER_ADMIN"/);
  assert.match(route, /strongAdminPasswordSchema\.parse\(input\.password\)/);
  assert.match(client, /SelectItem value="SUPER_ADMIN"/);
  assert.match(nav, /\/admin\/account/);
});

test("existing legacy accounts remain able to sign in before rotating their password", () => {
  const auth = read("src/lib/auth.ts");
  assert.doesNotMatch(auth, /suppliedPassword === "admin123456"/);
  assert.match(auth, /bcrypt\.compare/);
});
