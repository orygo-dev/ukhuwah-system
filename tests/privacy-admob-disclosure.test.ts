import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("student privacy policy discloses AdMob, UMP, teen treatment, and age boundary", async () => {
  const policy = await source("src/app/privacy/siswa/page.tsx");
  for (const required of [
    "Google AdMob",
    "Google Mobile Ads SDK",
    "Google User Messaging Platform (UMP)",
    "TEEN",
    "minimal 13 tahun",
    "Profil → Privasi iklan",
    "preview Mading",
    "Zona Baca, Mading, Tugas, dan Quiz",
    "https://policies.google.com/privacy",
  ]) {
    assert.match(policy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("teacher privacy policy is public and uses the teacher package identity", async () => {
  const policy = await source("src/app/privacy/guru/page.tsx");
  assert.match(policy, /com\.genpro\.teacher/);
  assert.match(policy, /Google AdMob/);
  assert.match(policy, /Google User Messaging Platform \(UMP\)/);
  assert.match(policy, /Profil → Privasi iklan/);
  assert.match(policy, /robots: \{ index: true, follow: true \}/);
});

test("public marketing surfaces link both privacy policies", async () => {
  const sources = await Promise.all([
    source("src/components/layout/marketing-footer.tsx"),
    source("src/components/marketing/landing-page-view.tsx"),
    source("src/components/marketing/information-page.tsx"),
  ]);
  for (const content of sources) {
    assert.match(content, /\/privacy\/siswa/);
    assert.match(content, /\/privacy\/guru/);
  }
});
