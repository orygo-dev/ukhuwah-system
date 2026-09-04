import { PrismaClient } from "@prisma/client";
import { sendWhatsAppMessage } from "../src/lib/whatsapp";

const prisma = new PrismaClient();

async function main() {
  const days = Number(process.argv[2] || 3);
  const now = new Date();
  const until = new Date(now);
  until.setDate(until.getDate() + days);

  const users = await prisma.user.findMany({
    where: {
      phone: { not: null },
      planExpiresAt: {
        gte: now,
        lte: until,
      },
      plan: { isNot: null },
    },
    include: { plan: true },
    take: 200,
  });

  let sent = 0;
  let failed = 0;
  for (const user of users) {
    if (!user.phone || !user.plan) continue;
    try {
      await sendWhatsAppMessage({
        target: user.phone,
        userId: user.id,
        purpose: "SUBSCRIPTION_EXPIRY_REMINDER",
        variables: {
          name: user.name,
          packageName: user.plan.name,
          expiredAt: user.planExpiresAt?.toLocaleDateString("id-ID") || "-",
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[reminder failed] ${user.email}`, err);
    }
  }

  console.log(JSON.stringify({ checked: users.length, sent, failed, days }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
