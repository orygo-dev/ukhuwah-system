import { PrismaClient } from "@prisma/client";
import {
  generateProviderApiKey,
  hashProviderApiKey,
} from "../src/lib/provider-api";

const prisma = new PrismaClient();

function readArg(name: string, fallback?: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  const name = readArg("name", "GenPro")!;
  const slug = slugify(readArg("slug", name)!);
  const monthlyCreditLimit = Number(readArg("credits", "1000"));
  const planName = readArg("plan", "pilot")!;
  const activeDays = Number(readArg("days", "30"));
  const allowedToolsArg = readArg("tools", "modul-ajar");
  const allowedTools = allowedToolsArg
    ? allowedToolsArg.split(",").map((tool) => tool.trim()).filter(Boolean)
    : null;

  if (!slug) throw new Error("Slug client provider tidak valid.");
  if (!Number.isInteger(monthlyCreditLimit) || monthlyCreditLimit <= 0) {
    throw new Error("--credits harus angka bulat lebih dari 0.");
  }
  if (!Number.isInteger(activeDays) || activeDays <= 0) {
    throw new Error("--days harus angka bulat lebih dari 0.");
  }

  const apiKey = generateProviderApiKey();
  const apiKeyHash = hashProviderApiKey(apiKey);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + activeDays);

  const client = await prisma.providerClient.upsert({
    where: { slug },
    create: {
      name,
      slug,
      apiKeyHash,
      monthlyCreditLimit,
      planName,
      allowedTools,
      periodStart,
      periodEnd,
      metadata: { createdByScript: true },
    },
    update: {
      name,
      apiKeyHash,
      monthlyCreditLimit,
      planName,
      allowedTools,
      status: "ACTIVE",
      periodStart,
      periodEnd,
      usedCredits: 0,
      metadata: { rotatedByScript: true },
    },
  });

  console.log("Provider client siap.");
  console.log(`Client: ${client.name} (${client.slug})`);
  console.log(`Plan: ${client.planName}`);
  console.log(`Monthly credit limit: ${client.monthlyCreditLimit}`);
  console.log(`Active until: ${client.periodEnd?.toISOString()}`);
  console.log(`Allowed tools: ${allowedTools?.join(", ") || "all"}`);
  console.log("");
  console.log("Simpan API key ini sekarang. Guru Space hanya menyimpan hash:");
  console.log(apiKey);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
