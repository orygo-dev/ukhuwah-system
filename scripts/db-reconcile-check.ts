/**
 * Verify production DB has required PJJ / push objects.
 * Run on server after `npx prisma migrate deploy`:
 *   npm run db:reconcile-check
 *
 * Exit 0 = all present. Exit 1 = missing objects (see docs/DB_RECONCILE_CHECKLIST.md).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; hint?: string };

const REQUIRED_COLUMNS: Record<string, string[]> = {
  live_class_sessions: [
    "whiteboard_version",
    "whiteboard_snapshot_version",
    "whiteboard_snapshot",
    "room_mode",
  ],
  live_class_participants: ["can_publish_media", "livekit_participant_sid"],
};

const REQUIRED_TABLES = [
  "live_class_chat_messages",
  "live_class_whiteboard_events",
  "live_class_quizzes",
  "live_class_quiz_questions",
  "live_class_quiz_attempts",
  "live_class_quiz_answers",
  "push_device_tokens",
  "merchant_stores",
  "marketplace_products",
  "marketplace_cart_items",
  "marketplace_orders",
  "marketplace_sub_orders",
  "marketplace_order_items",
];

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
  `;
  return Number(rows[0]?.cnt ?? 0) > 0;
}

async function main() {
  const checks: Check[] = [];

  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    for (const column of columns) {
      const ok = await columnExists(table, column);
      checks.push({
        name: `column ${table}.${column}`,
        ok,
        hint: ok ? undefined : `ALTER TABLE \`${table}\` ADD COLUMN ... (see docs/DB_RECONCILE_CHECKLIST.md)`,
      });
    }
  }

  for (const table of REQUIRED_TABLES) {
    const ok = await tableExists(table);
    checks.push({
      name: `table ${table}`,
      ok,
      hint: ok ? undefined : `CREATE TABLE from prisma/migrations (see docs/DB_RECONCILE_CHECKLIST.md)`,
    });
  }

  const failed = checks.filter((c) => !c.ok);
  const passed = checks.filter((c) => c.ok);

  console.log(`\nDB reconcile check: ${passed.length}/${checks.length} OK\n`);
  for (const c of checks) {
    console.log(`${c.ok ? "✔" : "✘"} ${c.name}${c.hint ? `\n    → ${c.hint}` : ""}`);
  }

  if (failed.length > 0) {
    console.log(
      `\n${failed.length} missing object(s). Run repair SQL in docs/DB_RECONCILE_CHECKLIST.md, then re-run this script.\n`
    );
    process.exitCode = 1;
  } else {
    console.log("\nAll required PJJ/push objects present.\n");
  }
}

main()
  .catch((err) => {
    console.error("db-reconcile-check failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
