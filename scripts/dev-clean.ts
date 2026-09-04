/**
 * Hentikan proses di port 3000, hapus .next, jalankan next dev.
 * Gunakan saat CSS hilang, chunk error, atau vendor-chunks tidak ditemukan.
 */
import { spawn, execSync } from "child_process";
import { rmSync, existsSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..");
const nextDir = join(root, ".next");
const tsBuildInfo = join(root, "tsconfig.tsbuildinfo");
const PORT = process.env.PORT || "3000";

function killPort(port: string) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf8",
      });
      const pids = new Set<string>();
      for (const line of out.split("\n")) {
        const match = line.trim().match(/\s+(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`Proses port ${port} dihentikan (PID ${pid}).`);
        } catch {
          /* already gone */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
        stdio: "ignore",
        shell: true,
      });
    }
  } catch {
    /* nothing listening */
  }
}

killPort(PORT);

if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("Cache .next dihapus.");
}

if (existsSync(tsBuildInfo)) {
  rmSync(tsBuildInfo, { force: true });
  console.log("Cache TypeScript dihapus.");
}

console.log(`Menjalankan next dev pada port ${PORT}...`);
const child = spawn("npx", ["next", "dev", "-p", PORT], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
