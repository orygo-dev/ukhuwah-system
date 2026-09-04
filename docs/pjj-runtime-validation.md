# PJJ Runtime Validation

Date: 12 August 2026  
Environment identifier: `local-dev / localhost:3306/guru_space`  
Scope: migration and application smoke validation on the existing unpublished application; real LiveKit Cloud gate remains mandatory; maximum 25 participants.

## Environment and safety preflight

The owner confirmed that this application is unpublished and contains no important data. On that explicit basis, the existing local application/database was authorized as a non-production development validation target; no application clone was required.

| Safety gate | Status | Evidence |
|---|---|---|
| Database is not production | **PASS** | Exact target resolved to `localhost:3306/guru_space`; application is unpublished; owner confirmed there is no important data. |
| Target has a clear non-production identity | **PASS** | Recorded as `local-dev`; loopback-only database and local application URL. This is not evidence of a remote staging deployment. |
| Host/database matches authorized target | **PASS** | Destructive guard required exact host `localhost`/`127.0.0.1` and exact database `guru_space`. |
| LiveKit project is testing-only | **BLOCKED** | No environment or stored LiveKit URL/key/secret and no non-secret project identifier. |
| Webhook points to non-production application | **BLOCKED** | Generated webhook is `http://localhost:3000/api/livekit/webhook`, which LiveKit Cloud cannot reach as a public HTTPS endpoint. |
| No production credential used for load/chaos | **PASS** | No LiveKit credential exists, so no load/chaos request was sent to any provider. |

Credential values were never printed. No production deployment, commit, push, or production database operation was performed.

## Backup and migration

**PASS — local non-production database**

- Backup: `C:\Users\Baenk's\.codex\backups\guru-space-pjj\guru_space-pre-pjj-20260812-091822.sql`
- Size: 374,843 bytes
- SHA-256: `F16EB504D13BB4A98B47C719BA72F596C166B0A93C678877B9FCA0F6EBEAB62A`
- Restore proof: backup restored successfully into disposable database `guru_space_restore_verify_20260812091858`; 79 base tables were readable; only the disposable restore target was then removed.
- Pre-migration status: three PJJ migrations present but unapplied; the legacy non-empty database had no `_prisma_migrations` history and `prisma migrate deploy` correctly stopped with `P3005`.
- Root-cause remediation: added a reproducible application baseline migration, then retained the required additive PJJ order: baseline, chat persistence, participant SID, whiteboard persistence.
- Disposable migration proof exposed and fixed two real defects before the main database was touched:
  - chat unique-index identifier exceeded MySQL/MariaDB's 64-character limit;
  - whiteboard `kind` was `VARCHAR(32)` in SQL but unconstrained `String`/`VARCHAR(191)` in Prisma.
- The authorized local database was rebuilt because the owner confirmed that its data was not important and the verified backup remained available.
- Post-migration status: all four migrations finished, none rolled back; `prisma migrate status` reports up to date; `prisma migrate diff` reports no difference.
- Actual schema verification passed for participant SID, whiteboard columns/defaults, chat/whiteboard primary and unique indexes, and cascading foreign keys.
- Demo seed completed: 14 users and 5 students; no PJJ/Hybrid class is created by the general seed.

Residual risk: this proves migration reproducibility on MariaDB 10.4.32 locally, not on an independently hosted database or a production backup/restore process.

## Application smoke

**PASS — local web application**

- Database-backed teacher login succeeded with the seeded local demo identity.
- `/dashboard` and `/dashboard/pjj` returned successfully.
- PJJ sessions and intervention APIs returned HTTP 200.
- Empty PJJ assignment/session/intervention states rendered correctly.
- Capacity control and displayed LiveKit limit are both 25.
- Browser console contained no warning/error after the final navigation.
- A cleanup-only `AbortError` from notification polling and the stale UI default of 50 were reproduced, root-caused, fixed, and regression-tested.

## Source/regression evidence

- `npm run test:pjj`: **36/36 PASS** after the final capacity and cleanup changes.
- `npx tsc --noEmit`: **PASS**.
- `npx prisma validate`: **PASS**.
- `npx prisma migrate status`: **PASS**.
- database-to-Prisma schema diff: **PASS**, no difference.
- production build: **PASS** after final changes.

The final command evidence should be used if a later rerun changes these counts.

## Real LiveKit teacher/student E2E

**BLOCKED**

No LiveKit Cloud testing project is configured. Token issuance against a real provider, teacher/student room join, participant SID persistence, camera, microphone, subscription, student screen-share denial, chat, attendance, leave, and rejoin were not executed and are not PASS.

LiveKit project identifier: **not available**.

## Authorization attack tests

**BLOCKED at runtime**

Source/JWT tests reject forged moderator authority and student screen-share publication, but attacks have not been executed against a real LiveKit Cloud room.

## Webhook

**BLOCKED**

No publicly reachable HTTPS test application and no LiveKit Cloud testing project exist. Real event IDs, signature verification, duplicate delivery, retry, stale event, participant SID association, and attendance idempotency therefore have no provider-runtime evidence. Source concurrency/idempotency tests remain PASS.

## Network and TURN

**NOT TESTED**

Offline 3/10/30 seconds, `CONNECTED → RECONNECTING → CONNECTED`, media/chat/participant recovery, disconnect reasons, and TURN relay selection require the real two-participant room gate first.

## Load and participant 26

**NOT TESTED**

No 5/10/25 load was sent because the two-participant LiveKit gate is blocked. The hard cap remains 25 in the UI, scheduling API, configuration API, token/room policy, and tests. Participant 26 real-provider rejection has not been demonstrated.

## Physical devices

**NOT TESTED**

No physical Android/iOS device or device lab was available. No platform is marked PASS from simulation.

## Resource and race observations

- Polling for questions, attendance, and participants uses single-flight ownership and abort cleanup; overlap/cleanup tests pass.
- Lobby microphone/camera tracks have one owner and are stopped on cleanup; partial acquisition is preserved.
- Audio-output `devicechange` listener is removed on cleanup.
- Webhook duplicate/concurrent/stale SID tests pass without duplicate side effects.
- Browser navigation no longer logs normal request cancellation as an application error.
- Real peer-connection, media-track, webhook retry, and long-run heap behavior remain unmeasured until LiveKit Cloud is configured.

## Remaining risk

- No real LiveKit Cloud testing project or credentials.
- No public HTTPS application URL for provider webhook delivery.
- No real two-participant media/authorization/webhook/reconnect evidence.
- No 5/10/25 load evidence or participant 26 provider rejection.
- No physical-device matrix.

## Web attendance correction — 2026-08-28

Scope: web attendance panel incorrectly reported a student Offline after joining
the same LiveKit room. This section records local evidence, not a new claim of
production/staging or real LiveKit Cloud readiness. No remote server, database,
LiveKit project, PM2 configuration, or Android release was changed.

### Root causes and fixes

- The panel read `online` from webhook-backed database timestamps. The room's
  actual participants could already be active while those timestamps were
  absent/stale. The web badge and online counter now use the current room's
  LiveKit hooks, matched by the server-issued `user:<userId>` identity. Name,
  user-editable metadata, login session presence, and frontend payloads are not
  authoritative attendance evidence.
- Signal-only participants display Connecting, not Online; lost connection and
  teacher reconnect display recovery/unknown, not a false all-students Offline.
- Server attendance remains separate. The panel explicitly warns when current
  connection state/SID disagrees with persisted attendance. Manual selection is
  labelled **Koreksi kehadiran** and keeps its existing moderator authorization.
  Existing duration-based attendance policy is unchanged; this patch does not
  automatically mark everyone PRESENT or fabricate missing historical intervals.
- Webhook configuration/database failures were mixed into the invalid-signature
  401 handler. Configuration and persistence failures now return retryable 503;
  invalid signatures remain 401. A P2002 conflict is acknowledged as a duplicate
  only when that event's committed receipt exists. Logs contain event ID/type
  and a bounded Prisma code, never payloads, authorization headers, or raw errors.
- An old different-SID join could rewind a replacement connection. Older/equal
  joins cannot replace the current interval, and a SID-less leave cannot close an
  interval with a known SID. Transactional receipt/side-effect rollback remains.
- Read/write requests are single-flight with a 15-second abort timeout. Mount
  timer/unmount, event listeners, stale request results, and in-flight writes
  have cleanup. No polling interval was shortened and no media permissions,
  room capacity, token issuance, login, or billing policy was changed.

### Verification

- Before fix: actual panel rendering and webhook handler regression suite had
  **10 failures / 13 tests** (including active peer rendered Offline, departed
  peer rendered Online, DB failure returned 401, unrelated unique conflict
  incorrectly returned success).
- After fix: PJJ suite **58/58 PASS**, security **23/23 PASS**, existing student
  presence **15/15 PASS**, school commercialization **18/18 PASS**, MCQ **3/3
  PASS**. These use fixtures for DB/auth/provider; they are not MySQL concurrency
  or LiveKit Cloud tests.
- Next production build and TypeScript: **PASS**. Targeted ESLint: **PASS**, using
  installed Next flat configuration outside the repository (legacy project
  FlatCompat configuration remains incompatible with Next 16).
- Browser: localhost:4017 fixture imports the real panel, Room, RemoteParticipant,
  RoomContext and LiveKit React hooks. Join before webhook, leave before webhook,
  SID replacement, teacher reconnect/recovery, manual correction, API failure/
  recovery, and panel unmount: **PASS**. Listener count returns to baseline on
  unmount. This deliberately simulates provider events, not actual media/network.

Changed PJJ files: `live-attendance-panel.tsx`, `pjj-attendance-presence.ts`,
`pjj-single-flight.ts`, session `roster/route.ts`, `livekit.ts`, webhook `route.ts`,
`pjj-livekit-webhook.ts`, and the two attendance/webhook regression test files.
The PJJ correction needs **no new database migration**.

### Deployment checks still required

Real web teacher/student join and leave, event delivery, database persistence,
and reconnect on the user's server: **NOT TESTED in this patch**. The server's
specific webhook failure reason cannot be inferred from local tests. Verify the
existing LiveKit project's webhook URL, matching signing key, migration status,
and HTTP delivery results; a working video connection alone does not prove the
webhook is configured. Successful logs now include `pjj.webhook.processed` and
the provider event ID. Do not paste credentials into logs or chat.

If the warning persists, correct the webhook/server configuration; do not treat
the corrected Online badge as proof that attendance is saved. Events abandoned
by the provider cannot be reconstructed from a student's current connection.
The independent Siswa Online web feature, if deployed with this patch, has its
own `202608280001_student_presence` migration; see `student-presence.md`.

## Final decision

**NOT READY**

Local database migration and application smoke are now PASS, but the mandatory real LiveKit Cloud, webhook, reconnect, load, and physical-device gates are still blocked/not tested. The next action requires the owner to create or provide access to a LiveKit Cloud **testing** project and a public HTTPS test URL/tunnel for this same unpublished application. Secrets must be entered into the application's administrator integration form or local environment, not pasted into chat.
