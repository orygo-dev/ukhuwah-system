# PJJ Load Test Plan

## Dua lapisan yang tidak boleh dicampur

### 1. LiveKit media load

Gunakan LiveKit CLI `lk load-test` pada test project/region yang sama dengan production. Jalankan dari beberapa generator dengan CPU, bandwidth, dan file descriptor cukup. Traffic Cloud berbiaya dan harus dijadwalkan.

Profiles:

| Target | Mode | Publishers | Subscriber policy |
|---:|---|---:|---|
| 10 | meeting | 10 A/V | semua required tracks |
| 25 | meeting | 25 A/V | adaptive grid |
| 50 | classroom | 1-5 A/V | presenter + visible speakers |
| 100 | classroom | 1-10 A/V | selective video/audio |
| 250 | broadcast | 1-5 A/V | presenter only + promoted speaker |
| 500 | broadcast | 1-5 A/V | presenter only + promoted speaker |

Jangan memakai 250/500 all-publish/all-subscribe. Itu berbeda dari classroom product dan dapat melewati batas subscription Cloud.

Contoh pola command (sesuaikan CLI version yang dipasang di runner):

```text
lk load-test --url <url> --api-key <secret-ref> --api-secret <secret-ref> \
  --room <isolated-room> --video-publishers <n> --audio-publishers <n> --subscribers <n>
```

Secret hanya melalui CI secret store dan tidak disalin ke artifact/log command.

### 2. GenPro UI/E2E load

Browser nyata lebih mahal. Jalankan 2/8/25 real Chromium contexts per worker untuk rendering/media, lalu synthetic API clients untuk token/chat/question/roster traffic. Untuk 50-500 peserta, gunakan campuran real browsers dan LiveKit load bots; minimal beberapa real browsers mewakili teacher, visible student, offscreen student, low-end device emulation, dan reconnecting participant.

## Metrik

- token API success/latency/rate limit;
- join success and signal/media-active latency;
- unexpected disconnect and reconnect success/time;
- required presenter audio/video subscription success and first media time;
- packet loss/jitter/RTT, inbound bitrate, frames decoded/dropped/frozen;
- chat send-to-ack/fanout/replay latency and duplicate rate;
- webhook lag/failure/retry and attendance reconciliation;
- browser CPU, JS heap, DOM nodes, long tasks, responsiveness;
- server DB query latency/connections and API error rate;
- LiveKit participant/subscription quotas and Cloud region usage.

## Success criteria per run

- >=30-minute steady state plus 10-minute ramp and 10-minute recovery.
- Join >=99.9%; no capacity oversubscription.
- Required presenter media >=99.9%; first audio p95 <=3s after media active; first video p95 <=5s.
- Healthy-network unexpected disconnect <=0.1% participant-hours.
- Reconnect 1-10s outage >=99%, 30s >=95%; required media recovers p95 <=10s after reconnected.
- Chat p95 <=1s and duplicate/lost persisted messages =0.
- No browser crash; p95 interaction <100ms; no sustained main-thread utilization >70% on target low-end profile.
- Heap does not grow monotonically; post-churn growth <=10% after GC.
- Webhook reconciliation mismatch =0 after grace window.

## Run matrix

Untuk setiap target lakukan healthy baseline, 5% loss/100ms jitter, bandwidth step-down, 10s outage/recovery, 30s outage/recovery, dan 10% rapid join/leave churn. Ulangi minimal tiga kali dan laporkan median serta worst run, region, browser/OS, SDK versions, room profile, publisher count, and Cloud plan/quota.

## Stop conditions

Hentikan run bila biaya/traffic guard tercapai, error rate >5% selama 2 menit, required presenter audio hilang >30 detik, DB saturation >90%, atau generator menjadi bottleneck. Hasil run yang generatornya saturated tidak boleh digunakan untuk klaim kapasitas.

## Report template

| Field | Value |
|---|---|
| Build/commit | |
| LiveKit region/plan | |
| SDK versions | |
| Profile/target | |
| Join success/p50/p95/p99 | |
| Reconnect success/p95 | |
| Presenter audio/video success | |
| Chat p95/duplicates/loss | |
| CPU/heap/long tasks | |
| Webhook mismatch | |
| Acceptance | PASS/FAIL |

