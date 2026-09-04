import { PrismaClient } from "@prisma/client";
import { seedMarketplaceDemo } from "./marketplace-demo-seed";

if (
  process.env.ALLOW_DEMO_SEED !== "true" &&
  process.env.ALLOW_MARKETPLACE_DEMO_SEED !== "true"
) {
  throw new Error(
    "Set ALLOW_MARKETPLACE_DEMO_SEED=true untuk mengisi toko dan produk demo saja.",
  );
}

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding marketplace demo...");
  const result = await seedMarketplaceDemo(prisma);
  console.log(
    `Selesai: toko ${result.store}, ${result.productCount} produk PUBLISHED.`,
  );
  console.log(`Merchant: ${result.merchantEmail} / merchant123456`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
