# PJJ Staging Deployment Runbook

Date: 12 August 2026  
Scope: staging database and staging application only. Production is explicitly out of scope. The PJJ participant cap remains 25.

## Safety gates

Do not continue unless all of these are true:

- a dedicated staging database and staging application URL have been supplied;
- the database owner confirms that the target is not production and may be restored;
- `DATABASE_URL` comes from the staging secret store, not `.env` in this workspace;
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` belong to a dedicated LiveKit test project;
- webhook delivery points to the staging application only;
- a tested database backup exists;
- no live production class uses the target database or LiveKit project.

Never print connection strings, API keys, API secrets, access tokens, chat bodies, or cookies. Never use `prisma db push` for this release.

Before every database command, run a fail-closed target guard. The operator must set `PJJ_ENVIRONMENT=staging` and `PJJ_STAGING_DB_HOST` to the independently approved staging hostname:

```powershell
node -e "const u=new URL(process.env.DATABASE_URL||''); const expected=process.env.PJJ_STAGING_DB_HOST||''; if(process.env.PJJ_ENVIRONMENT!=='staging'||!expected||u.hostname!==expected||/prod(uction)?/i.test(u.hostname)){throw new Error('Refusing non-approved staging target')} console.log('Approved staging target verified')"
```

The guard must exit successfully without revealing the connection string. A local database is not a substitute for staging.

## Required migrations and order

The current source has one reproducible application baseline followed by exactly three PJJ migrations. Prisma applies them lexically in this safe order:

1. `202608100000_application_baseline`
   - creates the pre-PJJ application schema for a clean installation;
   - deliberately excludes chat persistence, participant SID, and whiteboard state so the additive PJJ migrations remain independently verifiable.
2. `202608110001_pjj_chat_messages`
   - creates `live_class_chat_messages`;
   - creates the idempotency unique index `(session_id, sender_id, client_message_id)`;
   - creates session/time and sender indexes plus foreign keys.
3. `202608120001_pjj_participant_sid`
   - adds nullable `live_class_participants.livekit_participant_sid`;
   - intentionally has no default, unique constraint, or standalone index.
4. `202608120002_pjj_whiteboard_state`
   - adds whiteboard version/snapshot columns to `live_class_sessions`;
   - creates `live_class_whiteboard_events`, sequence uniqueness, indexes, and foreign keys.

All changes are additive. Deployment order is **database migrations, schema verification, Prisma client/application deployment, then smoke tests**. New application code must not run against the old schema.

## Backup

1. Record the staging release identifier, database engine/version, current application revision, UTC time, and operator.
2. Stop scheduled staging jobs that could mutate PJJ state. Ensure no staging class is active.
3. Use an approved MySQL login path so the password is not placed on the command line:

```powershell
mysqldump --login-path=pjj-staging --single-transaction --routines --triggers --events --set-gtid-purged=OFF $env:PJJ_STAGING_DB_NAME --result-file $env:PJJ_STAGING_BACKUP_FILE
Get-Item -LiteralPath $env:PJJ_STAGING_BACKUP_FILE
Get-FileHash -Algorithm SHA256 -LiteralPath $env:PJJ_STAGING_BACKUP_FILE
```

4. Store the dump and checksum in the approved staging backup location.
5. Prove restore viability on a disposable database before migration. Do not overwrite the staging target during this check.

## Preflight checks

Run the target guard, then capture outputs in the execution record:

```powershell
npx.cmd prisma validate --schema prisma/schema.prisma
npx.cmd prisma migrate status --schema prisma/schema.prisma
npm.cmd run test:pjj
npx.cmd tsc --noEmit
```

Additionally verify:

- the baseline plus three PJJ migration directories are present and unmodified;
- the staging database contains the prerequisite `users`, `live_class_sessions`, and `live_class_participants` tables;
- no migration with the same name is partially applied;
- there is enough disk space for the backup, new tables, indexes, and temporary DDL work;
- MySQL supports `JSON`, `DATETIME(3)`, and the required foreign-key operations;
- the staging LiveKit project quota supports 25 participants plus the explicit rejected participant 26 attempt;
- staging webhook signing credentials and URL are configured without exposing them.

If `prisma migrate status` reports a failed or divergent migration, stop. Do not use `prisma migrate resolve`, edit `_prisma_migrations`, or manually patch schema without an approved DBA recovery plan.

## Migration execution

Run only after the backup and target guard pass:

```powershell
node -e "const u=new URL(process.env.DATABASE_URL||''); const expected=process.env.PJJ_STAGING_DB_HOST||''; if(process.env.PJJ_ENVIRONMENT!=='staging'||!expected||u.hostname!==expected||/prod(uction)?/i.test(u.hostname)){throw new Error('Refusing non-approved staging target')} console.log('Approved staging target verified')"
npx.cmd prisma migrate deploy --schema prisma/schema.prisma
npx.cmd prisma migrate status --schema prisma/schema.prisma
```

Record start/end timestamps, exit codes, applied migration names, and lock duration. Do not use `prisma migrate dev` against staging.

## Schema verification

Run read-only checks through the approved staging MySQL client. Confirm:

- `_prisma_migrations` shows all three PJJ migrations finished successfully;
- `live_class_participants.livekit_participant_sid` is nullable `varchar(191)` with no default;
- `live_class_chat_messages` has its primary key, three expected indexes, and two cascading foreign keys;
- `live_class_sessions` has `whiteboard_version` and `whiteboard_snapshot_version`, both non-null with default `0`, plus nullable JSON `whiteboard_snapshot`;
- `live_class_whiteboard_events` has its primary key, unique `(session_id, sequence)`, expected indexes, and two cascading foreign keys;
- pre-existing participant rows remain readable and have `NULL` SID unless a real staging webhook later establishes one.

Useful read-only queries:

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name LIKE '%pjj%' OR migration_name LIKE '%live_class%'
ORDER BY started_at;

SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
    table_name IN ('live_class_chat_messages', 'live_class_whiteboard_events')
    OR (table_name = 'live_class_participants' AND column_name = 'livekit_participant_sid')
    OR (table_name = 'live_class_sessions' AND column_name LIKE 'whiteboard_%')
  )
ORDER BY table_name, ordinal_position;

SELECT table_name, index_name, non_unique, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name IN ('live_class_chat_messages', 'live_class_whiteboard_events')
GROUP BY table_name, index_name, non_unique
ORDER BY table_name, index_name;
```

## Staging application deployment

1. Build the exact candidate revision; do not include unrelated working-tree files.
2. Inject staging-only `DATABASE_URL`, authentication settings, application URL, LiveKit URL/key/secret, and webhook configuration from the staging secret store.
3. Generate the Prisma client and build:

```powershell
npm.cmd ci
npx.cmd prisma generate --schema prisma/schema.prisma
npm.cmd run build
```

4. Deploy through the existing staging platform procedure. This repository does not define an automated staging deploy target, so the platform owner must supply and approve that command.
5. Keep the prior staging application artifact available for rollback.
6. Verify the new application reports healthy before directing LiveKit webhook traffic to it.

## Smoke tests

Start with one teacher and one student in a dedicated staging session:

1. authenticate both roles and issue tokens;
2. join the same real LiveKit Cloud room;
3. confirm presence and participant SID persistence;
4. publish teacher microphone/camera and receive both as student;
5. verify student microphone/camera policy and authoritative screen-share denial;
6. send persistent chat and confirm replay after rejoin;
7. draw/clear whiteboard and confirm late-join/reconnect hydration;
8. confirm attendance join/leave and webhook receipts without duplicates;
9. cancel a live session and confirm token gate closes before provider room deletion;
10. inspect diagnostics for correlation and redaction, never raw credentials or chat content.

Only after the two-participant smoke test passes may testing progress to 5, 10, and 25 participants. Participant 26 must be tested separately and rejected authoritatively.

## Rollback

### Application failure after successful migration

Roll back the staging application to the prior artifact. Leave the additive nullable/defaulted schema in place; the previous application ignores it. Confirm no staging room is active and rerun the previous-version smoke test.

### Migration failure or schema verification failure

1. Stop application deployment and staging traffic.
2. Preserve migration logs and database state for diagnosis.
3. Do not manually drop partially created PJJ objects and do not mark a failed migration resolved without DBA approval.
4. Restore the verified backup into a new/disposable staging database.
5. repoint only the staging application after the restored database passes integrity checks.
6. diagnose and correct the migration in a new reviewed change before retrying.

### LiveKit/runtime failure

Disable only the staging release or staging webhook endpoint, close the dedicated staging rooms, and roll back the staging application artifact. Do not rotate or change production LiveKit configuration.

## Execution record

For an actual run, record operator, UTC timestamps, approved staging host fingerprint (not credentials), backup checksum, migration status before/after, deployed revision, LiveKit project identifier, test participant IDs (non-sensitive aliases), all test metrics, failures, rollback actions, and final recommendation in `docs/pjj-runtime-validation.md`.

## Current execution status

**BLOCKED.** The inspected workspace has only a local MySQL configuration, no staging marker or staging deployment target, and no LiveKit URL/key/secret. No migration, deployment, database mutation, room creation, or webhook change was performed.
