# PJJ P2/P3 Source Hardening Verification

Date: 12 August 2026  
Scope: remaining source issues from `docs/pjj-production-audit.md`. This document does not replace staging/LiveKit runtime validation. Participant cap remains 25.

## PJJ-P2-001 — Independent web lobby devices

**Status: PASS (source verification).**

- Root cause: mic and camera were acquired in one `getUserMedia` call, so one denied/unavailable device discarded the usable device; a second effect could duplicate acquisition after failed join.
- Fix: one acquisition coordinator requests audio and video independently, combines successful tracks, classifies `NotAllowed`, `NotFound`, `NotReadable`, and `Overconstrained`, and owns one cleanup path. `joining` now restarts preview through the same effect rather than a duplicate effect.
- Files: `src/lib/pjj-media-preview.ts`, `src/components/pjj/room/live-join-lobby.tsx`, `tests/pjj/p2-readiness.test.ts`.
- Evidence: partial audio-success/camera-denied test, error matrix, track-stop assertion, TypeScript, production build.
- Residual risk: permission prompts and real camera/mic rendering require staging browser/device validation.

## PJJ-P2-002 — Polling overlap and stale responses

**Status: PASS (source verification).**

- Root cause: intervals and realtime refreshes could start overlapping requests or repeatedly abort/restart slow requests.
- Fix: a reusable single-flight runner accepts one request, skips overlap, owns its `AbortController`, and aborts on cleanup. Question badge and attendance/question refresh use it.
- Files: `src/lib/pjj-single-flight.ts`, PJJ room client, attendance panel, questions panel, tests.
- Evidence: concurrent second run is skipped, cleanup aborts the owned signal, and sequential reuse succeeds.
- Race/resource result: no stale winner and no request survives unmount.

## PJJ-P2-003 — List render cost

**Status: PASS for the supported maximum of 25.**

- Participant hooks are restricted to membership/track events instead of speaking churn where possible.
- Participant, attendance, and question rows use `content-visibility` and intrinsic sizing.
- The header subscribes only to participant membership updates.
- Residual risk: this is not evidence for unsupported 50/100/250/500-person rooms.

## PJJ-P2-004 — Question count over 100

**Status: PASS (source verification).**

- `openCount` comes from a dedicated database `count` query in parallel with the capped display page; it is not derived from the first 100 rows.
- Long-list rows now use deferred browser rendering.
- Residual risk: staging integration with 101/5,000 rows is still required.

## PJJ-P2-005 — Duplicate chat surfaces

**Status: PASS (source verification).**

- Root cause: the LiveKit `VideoConference` prefab always mounts its non-persistent chat in addition to GenPro persistent chat.
- Fix: PJJ now composes public LiveKit grid/control/audio components directly and sets `chat: false`; the prefab Chat component is no longer mounted. GenPro `LiveChatPanel` is the only chat surface/protocol.
- Evidence: configuration/source test, TypeScript, production build. The PJJ route first-load bundle decreased by approximately 3 kB.
- Residual risk: screen-share focus and grid behavior require real-room browser regression.

## PJJ-P2-006 — Speaker output and device change

**Status: PARTIAL.**

- Web: feature-detects `setSinkId`, enumerates audio outputs, switches the LiveKit active output, refreshes on `devicechange`, and removes its listener on cleanup.
- Unsupported browsers hide the selector instead of presenting a broken control.
- Mobile explicit speaker/Bluetooth selector and physical headset handoff are not verified and remain open.

## PJJ-P3-001 — API error taxonomy

**Status: PASS for critical PJJ routes (source verification).**

- Token, moderation, attendance, and question mutation errors now separate validation (`422`), transient database/service (`503`), LiveKit degradation (`502`), and unexpected fatal errors (`500`).
- Public responses are stable and do not expose raw exception messages. Structured server diagnostics use redaction and include retryability without secrets.
- Evidence: mapping table test covers validation, Prisma connectivity, LiveKit/provider, and fatal/redaction behavior.
- Residual risk: deployment log routing/alerts and failure injection against staging services remain required.

## PJJ-P3-002 — Virtual background

**Status: NOT IMPLEMENTED (non-blocking optional feature).**

Virtual background remains disabled. It is not required for the supported meeting profile and will not be enabled without processor lifecycle, fallback, capability, CPU, reconnect, and device tests.

## Verification

| Check | Result |
|---|---|
| `npm.cmd run test:pjj` | PASS — 31 tests, 0 failures |
| `npx.cmd tsc --noEmit` | PASS |
| `npm.cmd run build` | PASS — 104 static pages; only pre-existing unrelated lint warnings |
| Browser auth-guard smoke | PASS for protected-route redirect/login interaction; not a room E2E |
| Real staging/LiveKit/device tests | BLOCKED / NOT TESTED |

## Decision

Source hardening progressed, but overall runtime recommendation remains **NOT READY** until staging migration, real LiveKit E2E/media/webhook/reconnect, 25 participants, participant 26 rejection, and physical-device gates have evidence.
