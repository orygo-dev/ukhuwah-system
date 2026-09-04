# PJJ Regression Report

Tanggal verifikasi: 11 Agustus 2026

## Ringkasan keputusan

Status pasca-remediasi: **BELUM PRODUCTION READY untuk target 500 peserta**.

Semua P0 yang ditemukan pada source audit telah ditangani pada code path utama: atomic webhook processing, join truth dari webhook, role-based publish grants, pembatasan screen share siswa, validasi/otorisasi data packet, enforcement konfigurasi kapasitas, dan penutupan room saat sesi live dibatalkan. Sejumlah P1 juga selesai, tetapi whiteboard persistence, large-room selective subscription/broadcast policy, telemetry backend/alerting, mobile background policy, dan pengujian nyata dengan kredensial LiveKit belum selesai.

## Verifikasi yang lulus

| Pemeriksaan | Hasil |
|---|---|
| `npm.cmd run test:pjj` | 9 test lulus, 0 gagal |
| `npx.cmd tsc --noEmit` | Lulus |
| `npx.cmd prisma validate` | Schema valid |
| `npx.cmd prisma generate` | Lulus |
| `npm.cmd run build` | Lulus; 104 halaman statis dibuat dan route PJJ baru terdeteksi |
| `dart analyze ...live_class_screen.dart ...student_app.dart` | Lulus, tidak ada issue |
| `git diff --check` | Lulus; hanya warning normalisasi LF/CRLF, tidak ada whitespace error |

Build masih melaporkan warning lint lama di komponen notification dan reading yang berada di luar lingkup audit PJJ. Warning tersebut tidak menggagalkan build dan tidak berasal dari perubahan ini.

## Cakupan unit regression

- Klasifikasi attendance dan batas keterlambatan.
- Decode packet valid, malformed, dan oversized.
- Otorisasi metadata moderator.
- Penolakan forged persisted-chat packet dari participant client.
- Publish-source grant per role.
- Effective room capacity dan platform cap.

## Perbaikan yang telah diverifikasi secara statis

- Receipt webhook dan seluruh side effect berada dalam satu transaksi; kegagalan side effect tidak meninggalkan dedupe marker palsu.
- Token issuance tidak lagi menandai peserta online atau menaikkan `joinCount`.
- Join/leave webhook memiliki stale/duplicate timestamp guards.
- Student token tidak mendapat grant screen-share; teacher/moderator mendapat source yang sesuai.
- `RoomConfiguration.maxParticipants` ditetapkan dari kapasitas authoritative dan UI/API menolak angka di atas platform cap.
- Web memakai adaptive stream dan dynacast.
- Privileged room packets divalidasi terhadap participant metadata; persisted chat hanya diterima dari server RoomService.
- Chat mempunyai persistence, idempotent client message ID, history, optimistic state, dan server timestamp.
- Cancel sesi live menghapus room LiveKit terlebih dahulu.
- Web mempunyai reconnect/quality/track diagnostics; Flutter mempunyai single-flight ownership dan cleanup lifecycle.

## Belum dapat diverifikasi di workstation ini

- Webhook signature/retry menggunakan LiveKit deployment nyata.
- TURN-only path, packet loss, reconnect, Wi-Fi/4G handoff, Bluetooth, sleep/wake, dan backgrounding perangkat fisik.
- Load 25/100/250/500 peserta dan dampak CPU, bandwidth, database, serta webhook throughput.
- Quota, region, dan subscription limits tenant LiveKit Cloud yang akan dipakai produksi.
- Database migration dan rollback terhadap salinan data staging.

Gunakan skenario dan acceptance gates di `docs/pjj-test-plan.md` serta `docs/pjj-load-test.md`. Jangan menaikkan rollout di atas 25 peserta sebelum classroom selective-subscription policy dan profile 100 peserta lulus; jangan membuka 250/500 sebelum broadcast profile, quota Cloud, dan chaos test lulus.

## Release gate

1. Jalankan migrasi chat pada staging dan uji rollback/backup.
2. Hubungkan diagnostics ke metrics backend dengan dashboard dan alerts.
3. Implementasikan whiteboard snapshot/delta persistence.
4. Implementasikan classroom/broadcast selective subscription untuk >25 peserta.
5. Jalankan integration, E2E, device matrix, network chaos, dan load test nyata.
6. Ulangi audit security untuk token/data-channel dan lakukan canary bertahap.

Hanya setelah keenam gate tersebut lulus status dapat dipertimbangkan menjadi production ready.
