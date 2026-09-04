import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { detectImageMime } from "../../src/lib/image-signature";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("stale authorization and password sessions are revoked by a persisted version", () => {
  const schema = read("prisma/schema.prisma");
  const auth = read("src/lib/auth.ts");
  assert.match(schema, /authVersion\s+Int\s+@default\(0\)\s+@map\("auth_version"\)/);
  assert.match(auth, /dbUser\.authVersion !== session\.user\.authVersion/);

  for (const route of [
    "src/app/api/admin/users/[id]/route.ts",
    "src/app/api/auth/forgot-password/reset/route.ts",
    "src/app/api/mobile/v1/account/password/route.ts",
    "src/app/api/students/[id]/account/route.ts",
    "src/lib/student-accounts.ts",
  ]) {
    assert.match(read(route), /authVersion:\s*\{ increment: 1 \}/, route);
  }
});

test("authentication abuse limits are database-backed, race-safe, and cleaned up", () => {
  const limiter = read("src/lib/security-rate-limit.ts");
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model SecurityRateLimit/);
  assert.match(limiter, /TransactionIsolationLevel\.Serializable/);
  assert.match(limiter, /code === "P2002" \|\| code === "P2034"/);
  assert.match(limiter, /expiresAt: \{ lt:/);
  assert.match(limiter, /deleteMany/);

  const parentRoute = read("src/app/api/parent/verify/route.ts");
  assert.doesNotMatch(parentRoute, /new Map/);
  assert.match(parentRoute, /consumeSecurityRateLimit/);

  for (const route of [
    "src/lib/auth.ts",
    "src/app/api/partner/login/route.ts",
    "src/app/api/otp/request/route.ts",
    "src/app/api/otp/verify/route.ts",
    "src/app/api/auth/forgot-password/request/route.ts",
    "src/app/api/auth/forgot-password/reset/route.ts",
    "src/app/api/auth/register/route.ts",
  ]) {
    assert.match(read(route), /consumeSecurityRateLimit/, route);
  }
});

test("global production response hardening is enabled without blocking PJJ media", () => {
  const config = read("next.config.ts");
  assert.match(config, /poweredByHeader: false/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /camera=\(self\), microphone=\(self\)/);
});

test("proxy permits an invalidated cookie to reach login instead of redirect-looping", () => {
  const proxy = read("src/proxy.ts");
  assert.doesNotMatch(proxy, /if \(isLogin && token\)/);
});

test("production login cannot expose legacy demo or super-admin credentials", () => {
  const display = read("src/lib/app-display.shared.ts");
  const login = read("src/components/auth/login-form.tsx");
  const seed = read("prisma/seed.ts");
  assert.doesNotMatch(display, /admin@guruspace\.id \/ admin123456/);
  assert.doesNotMatch(login, /guru@demo\.sch\.id \/ guru123456/);
  assert.match(display, /sanitizePublicLoginSubtitle/);
  assert.match(seed, /ALLOW_DEMO_SEED !== "true"/);
});

test("provider quota is enforced by an atomic compare-and-increment", () => {
  const provider = read("src/app/api/provider/v1/generate/route.ts");
  const providerAuth = read("src/lib/provider-api.ts");
  assert.match(provider, /providerClient\.updateMany/);
  assert.match(provider, /usedCredits:\s*\{\s*lte:/);
  assert.match(provider, /charged\.count !== 1/);
  assert.match(provider, /DUPLICATE_EXTERNAL_REQUEST/);
  assert.match(providerAuth, /providerClient\.findUnique/);
  assert.doesNotMatch(providerAuth, /providerClient\.findMany/);
});

test("public school directory is bounded and does not load every region initially", () => {
  const directory = read("src/app/api/school-directory/route.ts");
  assert.match(directory, /take: 100/);
  assert.doesNotMatch(directory, /take: 5000/);
  assert.match(directory, /q\.length >= 2/);
  assert.match(directory, /where: provinceId \? \{ provinceId \} : \{ id: \{ in: \[\] \} \}/);
});

test("production ignores loopback AUTH_URL so mobile cookies stay on the public host", () => {
  const auth = read("src/lib/auth.ts");
  assert.match(auth, /function discardLoopbackAuthUrl/);
  assert.match(auth, /delete process\.env\[key\]/);
  assert.match(auth, /trustHost:\s*true/);
});

test("Android release and session storage fail closed", () => {
  const gradle = read("mobile/guruspace_mobile/android/app/build.gradle.kts");
  const manifest = read("mobile/guruspace_mobile/android/app/src/main/AndroidManifest.xml");
  const cookies = read("mobile/guruspace_mobile/lib/core/network/api_client.dart");
  const secureCookies = read("mobile/guruspace_mobile/lib/core/network/secure_cookie_storage.dart");
  assert.match(gradle, /key\.properties dan upload keystore wajib tersedia/);
  assert.doesNotMatch(gradle, /signingConfigs\.getByName\("debug"\)/);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(cookies, /SecureCookieStorage\(\)/);
  assert.doesNotMatch(cookies, /storage: FileStorage\('\$\{directory\.path\}\/auth_cookies'\)/);
  assert.match(secureCookies, /FlutterSecureStorage/);
});

test("mobile media boundaries reject spoofed content and unsafe browser execution", () => {
  const avatar = read("src/app/api/mobile/v1/student/profile/avatar/route.ts");
  const spotlight = read("src/app/api/student/spotlight/upload/route.ts");
  const media = read("src/lib/serve-public-upload.ts");
  const reader = read("mobile/guruspace_mobile/lib/features/student/presentation/student_ebook_reader_screen.dart");
  const push = read("mobile/guruspace_mobile/lib/core/notifications/push_notification_service.dart");
  assert.match(avatar, /detectImageMime\(bytes\)/);
  assert.match(avatar, /contentType: canonicalMime/);
  assert.match(spotlight, /hasValidImageSignature\(thumbBytes, thumbExt\)/);
  assert.match(media, /"Content-Type": fallbackType/);
  assert.doesNotMatch(media, /stored\.contentType \|\| fallbackType/);
  assert.match(reader, /JavaScriptMode\.disabled/);
  assert.match(reader, /isSameOriginAppUri\(destination\)/);
  assert.match(push, /maxImageBytes/);
  assert.match(push, /isSameOriginAppUri\(uri\)/);
});

test("image signature detection rejects extension and MIME spoofing", () => {
  assert.equal(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(
    detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    "image/png",
  );
  assert.equal(detectImageMime(Buffer.from("<script>alert(1)</script>")), null);
  assert.equal(detectImageMime(Buffer.from("RIFFxxxxNOTW")), null);
});
