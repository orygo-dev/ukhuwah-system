/**
 * Verifikasi aset CSS dev/prod — deteksi cache .next korup.
 * Jalankan: npx tsx scripts/verify-styles.ts
 * Opsional: VERIFY_URL=http://localhost:3000
 */
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function collectCssFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectCssFiles(full, rel));
    } else if (entry.name.endsWith(".css")) {
      files.push(rel);
    }
  }
  return files;
}

const cssDir = join(ROOT, ".next", "static", "css");
const baseUrl = process.env.VERIFY_URL || "http://localhost:3000";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

checks.push({
  name: "postcss.config.mjs",
  ok: existsSync(join(ROOT, "postcss.config.mjs")),
  detail: "postcss",
});

checks.push({
  name: "tailwind.config.ts",
  ok: existsSync(join(ROOT, "tailwind.config.ts")),
  detail: "tailwind",
});

checks.push({
  name: "src/app/globals.css",
  ok: existsSync(join(ROOT, "src/app/globals.css")),
  detail: "globals",
});

async function verifyLiveCss() {
  try {
    const res = await fetch(`${baseUrl}/login`, { redirect: "follow" });
    const html = await res.text();
    const hrefMatch = html.match(/href="(\/_next\/static\/css\/[^"]+\.css[^"]*)"/);
    if (!hrefMatch) {
      checks.push({
        name: "HTML memuat link stylesheet",
        ok: false,
        detail: res.status !== 200 ? `HTTP ${res.status}` : "tidak ada <link rel=stylesheet>",
      });
      return;
    }
    const cssPath = hrefMatch[1].split("?")[0];
    const cssRes = await fetch(`${baseUrl}${cssPath}`);
    const body = await cssRes.text();
    checks.push({
      name: "HTML memuat link stylesheet",
      ok: true,
      detail: cssPath,
    });
    checks.push({
      name: "Stylesheet URL dapat diakses",
      ok:
        cssRes.status === 200 &&
        (body.includes("@font-face") || body.includes("--background")),
      detail: `HTTP ${cssRes.status} — ${body.length} bytes`,
    });
  } catch (e) {
    checks.push({
      name: "Server dev dapat dijangkau",
      ok: false,
      detail: e instanceof Error ? e.message : "fetch gagal",
    });
  }
}

async function main() {
  await verifyLiveCss();

  const cssFiles = collectCssFiles(cssDir);
  checks.push({
    name: ".next/static/css ada file",
    ok: cssFiles.length > 0,
    detail: cssFiles.length ? cssFiles.join(", ") : "kosong — jalankan dev/build",
  });

  const failed = checks.filter((c) => !c.ok);
  console.log("\n=== VERIFIKASI CSS ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  }
  console.log(`\nHASIL: ${checks.length - failed.length}/${checks.length} lulus`);
  if (failed.length) {
    console.log("\nPerbaikan: hentikan dev server → npm run dev:clean");
    process.exit(1);
  }
}

main();
