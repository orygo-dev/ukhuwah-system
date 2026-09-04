import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APP_ADS_LINE = /^google\.com, pub-\d{16}, DIRECT, f08c47fec0942fa0$/;

test("app-ads.txt exposes exactly one valid direct Google seller", async () => {
  const content = await readFile("public/app-ads.txt", "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.equal(lines.length, 1);
  assert.match(lines[0], APP_ADS_LINE);
});

test("app-ads.txt is not intercepted by the authenticated proxy", async () => {
  const proxy = await readFile("src/proxy.ts", "utf8");
  assert.doesNotMatch(proxy, /app-ads\.txt/);
  assert.doesNotMatch(proxy, /"\/:path\*"/);
});

test("app-ads.txt has an explicit text response and cache policy", async () => {
  const nextConfig = await readFile("next.config.ts", "utf8");
  assert.match(nextConfig, /source:\s*"\/app-ads\.txt"/);
  assert.match(nextConfig, /text\/plain; charset=utf-8/);
  assert.match(nextConfig, /public, max-age=3600, must-revalidate/);
});
