import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const chatMigration = readFileSync(
  "prisma/migrations/202608110001_pjj_chat_messages/migration.sql",
  "utf8",
);

test("PJJ chat migration identifiers fit the MySQL/MariaDB 64-character limit", () => {
  const identifiers = [...chatMigration.matchAll(/`([^`]+)`/g)].map(
    (match) => match[1],
  );
  const oversized = identifiers.filter((identifier) => identifier.length > 64);

  assert.deepEqual(oversized, []);
  assert.match(
    chatMigration,
    /UNIQUE INDEX `live_class_chat_messages_session_id_sender_id_client_message_key`\(`session_id`, `sender_id`, `client_message_id`\)/,
  );
});

test("whiteboard event kind has the same bounded type in migration and Prisma model", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync(
    "prisma/migrations/202608120002_pjj_whiteboard_state/migration.sql",
    "utf8",
  );

  assert.match(schema, /kind\s+String\s+@db\.VarChar\(32\)/);
  assert.match(migration, /`kind` VARCHAR\(32\) NOT NULL/);
});
