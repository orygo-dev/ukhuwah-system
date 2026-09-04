const { execSync } = require("child_process");
const root = process.cwd();

function run(cmd) {
  console.log(">", cmd);
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

const step = process.argv[2] || "all";

if (step === "push" || step === "all") {
  run("npx prisma db push");
  run("npx prisma generate");
}
if (step === "seed" || step === "all") {
  run("npx tsx prisma/seed.ts");
}
if (step === "build" || step === "all") {
  run("npm run build");
}
if (step === "audit" || step === "all") {
  run("npx tsx scripts/audit-classroom.ts");
  run("npx tsx scripts/audit-parent-rapor.ts");
}
