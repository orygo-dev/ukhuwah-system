/**
 * Verifikasi chunk JS dev server — deteksi ChunkLoadError akibat cache .next korup.
 * Jalankan: npx tsx scripts/verify-chunks.ts
 */
const baseUrl = process.env.VERIFY_URL || "http://localhost:3000";

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];

async function main() {
  try {
    const dashRes = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    const dashFollow = await fetch(`${baseUrl}/dashboard`, { redirect: "follow" });
    const dashHtml = await dashFollow.text();

    checks.push({
      name: "GET /dashboard (route)",
      ok: dashRes.status === 200 || dashRes.status === 307,
      detail:
        dashRes.status === 307
          ? "HTTP 307 → login (normal tanpa sesi)"
          : `HTTP ${dashRes.status}`,
    });

    const loginRes = await fetch(`${baseUrl}/login`);
    const loginHtml = await loginRes.text();
    checks.push({
      name: "GET /login",
      ok: loginRes.status === 200,
      detail: `HTTP ${loginRes.status}`,
    });

    const chunkRe = /\/_next\/static\/chunks\/[^"']+\.js/g;
    const loginChunks = [...loginHtml.matchAll(chunkRe)].map((m) => m[0]);
    checks.push({
      name: "Chunk JS di halaman login",
      ok: loginChunks.length >= 2,
      detail: loginChunks.length ? `${loginChunks.length} chunk` : "tidak ada",
    });

    if (loginChunks.length > 0) {
      const mainChunk = loginChunks.find((c) => c.includes("main-app")) || loginChunks[0];
      const chunkRes = await fetch(`${baseUrl}${mainChunk.split("?")[0]}`);
      const body = await chunkRes.text();
      checks.push({
        name: "Chunk JS dapat diakses",
        ok: chunkRes.status === 200 && body.length > 100 && !body.includes("Not Found"),
        detail: `HTTP ${chunkRes.status} — ${mainChunk}`,
      });
    }

    const dashboardChunkInHtml = dashHtml.includes("app/dashboard/page");
    if (dashboardChunkInHtml) {
      const m = dashHtml.match(/\/_next\/static\/chunks\/app\/dashboard\/page\.js[^"']*/);
      if (m) {
        const chunkRes = await fetch(`${baseUrl}${m[0].split("?")[0]}`);
        checks.push({
          name: "Chunk dashboard/page.js",
          ok: chunkRes.status === 200,
          detail: `HTTP ${chunkRes.status}`,
        });
      }
    } else {
      checks.push({
        name: "Chunk dashboard/page.js",
        ok: true,
        detail: "skip — halaman redirect login (login dulu untuk uji penuh)",
      });
    }

    const cssMatch = dashHtml.match(/\/_next\/static\/css\/[^"']+\.css/) ||
      loginHtml.match(/\/_next\/static\/css\/[^"']+\.css/);
    if (cssMatch) {
      const cssRes = await fetch(`${baseUrl}${cssMatch[0].split("?")[0]}`);
      checks.push({
        name: "Stylesheet layout",
        ok: cssRes.status === 200,
        detail: `HTTP ${cssRes.status}`,
      });
    }
  } catch (e) {
    checks.push({
      name: "Server dev dapat dijangkau",
      ok: false,
      detail: e instanceof Error ? e.message : "fetch gagal",
    });
  }

  const failed = checks.filter((c) => !c.ok);
  console.log("\n=== VERIFIKASI CHUNK ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  }
  console.log(`\nHASIL: ${checks.length - failed.length}/${checks.length} lulus`);
  if (failed.length) {
    console.log("\nPerbaikan: npm run dev:clean lalu hard refresh browser (Ctrl+Shift+R)");
    process.exit(1);
  }
}

main();
