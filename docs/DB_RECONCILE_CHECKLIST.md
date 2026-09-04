# Database reconcile checklist (production)

Use when Prisma reports `migrate status` / `No pending migrations` but the app throws `P2022` (column does not exist) or chat/whiteboard/quiz fails.

**Do not use `prisma db push` on production.** Prefer `npx prisma migrate deploy`. If history is marked applied but objects are missing, apply the SQL below manually, then keep `_prisma_migrations` as-is.

## 1. Status

```bash
cd /www/wwwroot/guruspaceai.cloud/guruspaceai.cloud
git rev-parse --short HEAD
npx prisma migrate status
npm run db:reconcile-check
```

`db:reconcile-check` exits **0** when all required columns/tables exist; **1** when repair SQL is still needed.

## 2. Required PJJ objects

```sql
SHOW COLUMNS FROM live_class_sessions LIKE 'room_mode';
SHOW COLUMNS FROM live_class_sessions LIKE 'whiteboard%';
SHOW COLUMNS FROM live_class_participants LIKE 'livekit_participant_sid';
SHOW COLUMNS FROM live_class_participants LIKE 'can_publish_media';
SHOW TABLES LIKE 'live_class_chat_messages';
SHOW TABLES LIKE 'live_class_whiteboard_events';
SHOW TABLES LIKE 'live_class_quizzes';
SHOW TABLES LIKE 'live_class_quiz_questions';
SHOW TABLES LIKE 'live_class_quiz_attempts';
SHOW TABLES LIKE 'live_class_quiz_answers';
SHOW TABLES LIKE 'push_device_tokens';
```

## 3. Repair SQL (skip any step that errors with Duplicate)

```sql
-- whiteboard columns
ALTER TABLE `live_class_sessions`
  ADD COLUMN `whiteboard_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `whiteboard_snapshot_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `whiteboard_snapshot` JSON NULL;

-- classroom mode
ALTER TABLE `live_class_sessions`
  ADD COLUMN `room_mode` ENUM('MEETING', 'CLASSROOM') NOT NULL DEFAULT 'MEETING';

ALTER TABLE `live_class_participants`
  ADD COLUMN `can_publish_media` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `live_class_participants`
  ADD COLUMN `livekit_participant_sid` VARCHAR(191) NULL;
```

For full table DDL, copy from:

- `prisma/migrations/202608110001_pjj_chat_messages/migration.sql`
- `prisma/migrations/202608120002_pjj_whiteboard_state/migration.sql`
- `prisma/migrations/202608210001_pjj_classroom_quiz/migration.sql`
- `prisma/migrations/202608170001_push_device_tokens/migration.sql`

## 4. Restart

```bash
npm run db:reconcile-check
npx prisma generate
npm run build
pm2 restart ecosystem.config.cjs --only guruspace
```

Re-run `db:reconcile-check` until it reports all objects present before restarting PM2.
