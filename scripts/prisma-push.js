const { execSync } = require("child_process");
const root = process.cwd();

function run(cmd) {
  console.log(">", cmd);
  execSync(cmd, { cwd: root, stdio: "inherit", shell: true });
}

run("npx prisma db push");
run("npx prisma generate");
