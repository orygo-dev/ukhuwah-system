# PJJ Participant SID Migration Review

Migration: `prisma/migrations/202608120001_pjj_participant_sid/migration.sql`  
Review date: 12 August 2026  
Execution status: **NOT RUN by this remediation**.

## Source review

The migration adds one nullable `VARCHAR(191)` column, `livekit_participant_sid`, to `live_class_participants`.

- **Existing-record compatibility:** PASS. Existing rows receive `NULL`; no table backfill or fabricated SID is required. The webhook processor deliberately treats an online legacy row without a SID conservatively and will establish a SID on the next valid inactive join.
- **Nullable transition:** PASS. The column must remain nullable because roster rows exist before media connection and disconnected participants have no active SID.
- **Default behavior:** PASS. No default is correct; an empty or generated default would falsely identify an active connection.
- **Index requirement:** no standalone index is required. Runtime lookup remains on existing unique `(session_id, user_id)` and updates use the participant primary key plus SID as a compare-and-swap predicate.
- **Uniqueness requirement:** no SID uniqueness constraint is required. SID is provider-scoped and transient; application integrity is anchored by `(session_id, user_id)`.
- **Lock/size risk:** adding a nullable column may still take a metadata/table lock depending on MySQL version and DDL algorithm. Run against a staging clone and schedule production DDL in a controlled window.
- **Deployment ordering:** database migration first, then application. Deploying code first makes participant webhook writes fail until the column exists; retries should not be used as a migration strategy.
- **Mixed-version behavior:** new schema + old application is safe because the old code ignores the nullable column. Old schema + new application is unsafe.
- **Rollback:** application rollback is safe while leaving the nullable column in place. Dropping the column loses active SID correlation and should only happen after rolling application code back and draining active rooms. Do not drop it during an active class.

## Recommended staging procedure

1. Back up and restore a production-like database to staging.
2. Confirm no migration with the same identifier was partially or fully applied.
3. Apply using the normal non-production migration workflow.
4. Verify existing participant rows have `NULL`, token issuance leaves it `NULL`, join writes the LiveKit SID, and leave clears it.
5. Run duplicate-SID/replacement and webhook retry suites against staging.
6. Measure DDL lock duration and define the production rollback/runbook.

## Decision

**SOURCE REVIEW PASS.** Production execution remains prohibited until the staging procedure and operational approval are complete. The migration file was reviewed but not modified in this P1 pass.
