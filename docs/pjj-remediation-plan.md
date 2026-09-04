# PJJ Remediation Plan

## Urutan wajib

### Wave 0 — Test harness dan safety seam

Tambahkan unit/integration runner web dan adapter kecil untuk webhook processor, token policy, room diagnostics, serta data-message validation. Tidak perlu rewrite UI. Buat fixture role/token/event yang deterministik.

### Wave 1 — P0 data integrity

1. RED: test webhook retry setelah side-effect failure.
2. GREEN: proses event dan dedupe secara transactional/status-aware.
3. RED: token-only tidak boleh membuat online/joinCount.
4. GREEN: pindahkan actual join ke webhook `participant_joined`; tangani `participant_connection_aborted`.
5. Tambahkan timestamp/event guards agar stale leave tidak menutup join yang lebih baru.
6. VERIFY: duplicate/retry/out-of-order/concurrent webhook suite.

### Wave 2 — P0 authorization

1. Definisikan role policy tunggal:
   - teacher/moderator: mic, camera, screen share, data, subscribe, moderation;
   - tutor: eksplisit berdasarkan product decision;
   - student small meeting: mic/camera/data, no screen share;
   - student large classroom: subscribe/data, publish only after promotion.
2. Set `canPublishSources`/`canPublish` dari backend token.
3. Validasi all data message dengan schema dan actual sender.
4. Pindahkan privileged command ke authorized backend/RoomService; target packet secara selektif.
5. RED/GREEN adversarial tests.

### Wave 3 — Capacity dan media scalability

1. Enforce `maxParticipants` pada issuance dengan authoritative LiveKit participant count/room config dan handle concurrency.
2. Aktifkan adaptive stream + dynacast web.
3. Pisahkan mode:
   - `MEETING`: <=25, semua dapat publish sesuai role.
   - `CLASSROOM`: 26-100, teacher/cohost always-on; bounded student speakers.
   - `BROADCAST`: >100, presenter publishers terbatas, audience subscribe-only, chat/question via backend.
4. Selective video subscription berdasarkan presenter, active speaker, pin, dan viewport. Batasi audio subscriptions ke presenter + promoted speakers untuk >100.
5. Jangan mengizinkan 250/500 hingga profile load test lulus dan plan LiveKit Cloud mencukupi.

### Wave 4 — Lifecycle, reconnect, dan diagnostics

Implement state machine `IDLE -> CONNECTING -> CONNECTED -> RECONNECTING -> CONNECTED -> DISCONNECTING -> DISCONNECTED`. Catat reason dan jangan remount room pada transient failure. Tambahkan restored/degraded UI dan track-health diagnostics.

Flutter: room dimiliki segera setelah konstruksi; gunakan single-flight attempt ID, cleanup failed/in-flight room, dan pass lobby preferences. Tentukan kebijakan background audio sebelum menambah platform capability.

### Wave 5 — State features

- Chat: persistent server ID/sequence/history, realtime notification, status pending/sent/failed, capped/virtualized viewport.
- Whiteboard: versioned snapshot + delta, authorization clear, compaction and memory cap.
- Questions/attendance: cursor pagination, DB count, push invalidation with guarded polling fallback.
- Cancel/end: terminate LiveKit room and surface explicit disconnect reason.

### Wave 6 — Observability

Structured event envelope:

```json
{
  "event": "pjj.track.subscribed",
  "timestamp": "ISO-8601",
  "clientSessionId": "uuid",
  "liveSessionId": "cuid",
  "roomNameHash": "sha256-prefix",
  "participantIdentityHash": "sha256-prefix",
  "platform": "web|android|ios",
  "sdkVersion": "2.21.0",
  "connectionState": "connected",
  "trackSource": "microphone",
  "trackSidSuffix": "redacted",
  "outcome": "success"
}
```

Required events: token request outcome, connect start/success/failure/latency, reconnect start/success/failure/attempt, disconnect reason, connection quality transitions, local publish/mute/unpublish, remote publish/subscribe/unsubscribe/mute, audio playback blocked/restored, device permission/selection/change (hashed model-free identifiers), background processor error/fallback, chat send/ack/failure.

Never log JWT, API secret/key, auth cookie, full identity, message body, student name, or raw device label. Add redaction tests. Metrics/alerts: join success, p95 latency, disconnect and reconnect rates, presenter audio subscribed-but-not-playing heuristic, webhook lag/failure, phantom-online reconciliation, room capacity saturation.

## Rollout

1. Internal 2-5 user soak.
2. Canary classes <=10 with diagnostics.
3. 25-user meeting profile.
4. 50/100 classroom only after selective policy.
5. 250/500 broadcast profile only after Cloud quota confirmation and load acceptance.

Feature flags harus dapat mematikan student video, screen share, custom data features, dan virtual background tanpa memutus room.

