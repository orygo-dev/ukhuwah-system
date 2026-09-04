# PJJ Production Readiness Audit

Tanggal: 11 Agustus 2026  
Status: **NOT PRODUCTION-READY** untuk kelas besar atau deployment tanpa mitigasi P0/P1.

## Ringkasan eksekutif

Lifecycle room web dasar cukup deterministik karena satu `LiveKitRoom` dimount setelah token diperoleh dan SDK melakukan reconnect otomatis. Audio web memakai `RoomAudioRenderer` dan control bar memiliki recovery autoplay. Secret LiveKit tidak ditemukan di client.

Namun empat blocker utama membuat sistem belum layak production: pencatatan participant dilakukan sebelum media connect dan dihitung lagi oleh webhook; dedupe webhook dapat mengakui retry tanpa menyelesaikan side effect; data packet mempercayai payload client sehingga dapat dipalsukan; dan UI mengizinkan kapasitas sampai 500 sementara web auto-subscribe semua track, optimisasi video default mati, batas kapasitas tidak pernah ditegakkan, serta LiveKit Cloud membatasi subscription media per participant.

Confidence memakai skala High/Medium/Low. “High” berarti jalur source dan perilaku SDK terpasang terverifikasi; test runtime multi-client tetap diwajibkan sebelum release.

## P0 — Critical

### PJJ-P0-001 — Webhook dapat dianggap selesai sebelum side effect selesai

- **Severity:** P0
- **File:** `src/app/api/livekit/webhook/route.ts:17-26`
- **Function/component:** `POST`
- **Root cause:** ID event dimasukkan ke `LiveKitWebhookEvent` sebelum update session/participant/attendance. Bila proses setelah insert gagal, retry dengan ID sama langsung dibalas `duplicate: true` dan side effect yang gagal tidak pernah diulang.
- **Scenario:** DB timeout/deadlock setelah insert dedupe tetapi sebelum update `LiveClassParticipant`.
- **Dampak:** participant online/offline dan durasi kehadiran hilang permanen; room dapat tertinggal `LIVE`; data attendance corrupt.
- **Reproduce:** mock `liveKitWebhookEvent.create` sukses, paksa update berikutnya gagal, lalu kirim event identik dua kali; request kedua mengembalikan sukses tanpa memperbaiki data.
- **Rekomendasi:** proses dedupe marker dan seluruh side effect dalam satu transaction; simpan status `PROCESSING/PROCESSED/FAILED` atau rollback marker saat side effect gagal.
- **Test wajib:** integration test failure injection + retry idempotency untuk seluruh event type.
- **Confidence:** High.

### PJJ-P0-002 — Token issuance menciptakan phantom join dan double counting

- **Severity:** P0
- **File:** `src/app/api/livekit/token/route.ts:41-61`, `src/app/api/livekit/webhook/route.ts:46-63`
- **Function/component:** token `POST`, webhook `participant_joined`
- **Root cause:** token endpoint menetapkan `lastJoinedAt`, menghapus `lastLeftAt`, dan menaikkan `joinCount` sebelum koneksi media; webhook participant aktif mengulang operasi yang sama.
- **Scenario:** token berhasil tetapi WebRTC gagal; atau join normal dengan webhook.
- **Dampak:** user terlihat online padahal tidak pernah masuk, joinCount selalu berlebih, dan attendance/diagnostics tidak dapat dipercaya.
- **Reproduce:** panggil endpoint token tanpa connect lalu buka roster; ulangi dengan connect sukses dan lihat joinCount naik dua kali.
- **Rekomendasi:** token issuance hanya membuat/menjaga roster row tanpa join timestamp/count. Jadikan `participant_joined` (media active) satu-satunya sumber join aktual; tangani `participant_connection_aborted`.
- **Test wajib:** token-only, successful join, aborted join, reconnect, duplicate identity.
- **Confidence:** High; dokumentasi resmi menyatakan `participant_joined` terjadi setelah media connection aktif.

### PJJ-P0-003 — Data packet dapat memalsukan moderator dan identitas chat

- **Severity:** P0
- **File:** `live-room-data.ts`, `live-chat-panel.tsx:38-54`, `live-class-room-client.tsx:231-249`, `live-whiteboard-panel.tsx:94-112`
- **Function/component:** `decodeRoomData` dan seluruh `DataReceived` handler
- **Root cause:** schema hanya memeriksa adanya `type`; handler mengabaikan participant pengirim dan mempercayai `senderIdentity`, `senderName`, `targetIdentity`, serta `wb:clear` dari payload.
- **Scenario:** student memanggil `publishData` dari DevTools/custom client dengan payload `mod:muted`, `mod:request_unmute`, chat beridentitas guru, atau `wb:clear`.
- **Dampak:** impersonation, social engineering, penghapusan papan, gangguan kelas, dan trust UI rusak.
- **Reproduce:** join sebagai student lalu kirim JSON forged melalui SDK/data channel.
- **Rekomendasi:** validasi runtime ketat; derive sender identity/name/role dari participant event/metadata yang ditandatangani token; abaikan privileged message dari non-moderator; arahkan command penting melalui backend/RoomService dan gunakan topic/destination identity.
- **Test wajib:** adversarial packet tests untuk spoofed sender, role, unknown type, oversized payload, malformed fields.
- **Confidence:** High.

### PJJ-P0-004 — Kapasitas 500 ditawarkan tetapi arsitektur subscription tidak mendukungnya

- **Severity:** P0
- **File:** `sessions/route.ts:15,103-129`, `teacher-pjj-client.tsx:603-618`, `live-class-room-client.tsx:443-450`, `src/lib/livekit.ts:195-219`
- **Function/component:** session scheduling, token creation, `LiveKitRoom`
- **Root cause:** `maxParticipants` hanya disimpan di DB. Tidak dipasang pada room config dan tidak diperiksa saat token issuance. Web memakai `autoSubscribe=true`; `adaptiveStream` dan `dynacast` default false. LiveKit Cloud mendokumentasikan limit 100 audio dan 100 video subscription per participant.
- **Scenario:** guru membuat sesi 250/500, banyak siswa menyalakan kamera/mic.
- **Dampak:** join melebihi kapasitas kebijakan, subscription gagal/degraded, bandwidth/CPU/RAM melonjak, audio/video hilang, kelas tidak usable.
- **Reproduce:** buat sesi max 500; issuance token ke participant ke-501 tetap sukses. Jalankan 101+ publishers dan amati subscription/error.
- **Rekomendasi:** enforce capacity atomik di backend/LiveKit room config; definisikan mode `MEETING` kecil dan `CLASSROOM` besar; pada kelas besar hanya guru/cohost dan sejumlah speaker boleh publish, subscribe video secara selektif, dan jangan subscribe ratusan audio track.
- **Test wajib:** capacity race test dan load profile 10/25/50/100/250/500 yang memvalidasi media, bukan hanya connection.
- **Confidence:** High untuk source/config; capacity Cloud final bergantung plan tenant.

### PJJ-P0-005 — Student dapat publish screen share dan semua source media

- **Severity:** P0
- **File:** `src/lib/livekit.ts:203-218`, `VideoConference` control derivation
- **Function/component:** `createLiveKitJoinToken`
- **Root cause:** seluruh role diberi `canPublish: true` tanpa `canPublishSources`; control bar otomatis menampilkan screen share.
- **Scenario:** satu atau banyak student memulai screen share/video secara bersamaan atau client termodifikasi publish source yang tidak diinginkan.
- **Dampak:** penyalahgunaan privilege, bandwidth explosion, presenter terganggu, meeting dapat unusable.
- **Reproduce:** join sebagai student dan gunakan tombol screen share; grant mengizinkannya.
- **Rekomendasi:** gunakan `canPublishSources` per role; student default mic/camera sesuai kebijakan dan tanpa screen share, atau audience `canPublish=false` lalu promote melalui server API.
- **Test wajib:** decode token/grant role matrix dan E2E control visibility/server rejection.
- **Confidence:** High.

## P1 — High

### PJJ-P1-001 — Optimisasi video web tidak aktif

- **Severity:** P1
- **File:** `live-class-room-client.tsx:443-450`
- **Function/component:** `LiveKitRoom`
- **Root cause:** tidak ada `options={{ adaptiveStream: true, dynacast: true }}`; default SDK 2.21.0 adalah false.
- **Scenario:** grid/pagination dengan banyak publisher video.
- **Dampak:** video hidden/offscreen tetap menerima data dan publisher mengirim layer yang tidak diperlukan; CPU/bandwidth lebih tinggi.
- **Reproduce:** inspect `room.options`/stats pada 25+ video dan pindah page/tab.
- **Rekomendasi:** aktifkan keduanya dan verifikasi attach/visibility behavior dengan prefab versi terpasang.
- **Test wajib:** WebRTC stats visible vs hidden tiles dan regression screen share.
- **Confidence:** High.

### PJJ-P1-002 — Tidak ada state/diagnostics reconnect yang dapat dioperasikan

- **Severity:** P1
- **File:** `live-class-room-client.tsx`, `live_class_screen.dart`
- **Function/component:** connected room lifecycle
- **Root cause:** aplikasi hanya mengandalkan toast prefab web; tidak mencatat Reconnecting/Reconnected/reason/quality/track state. Mobile hanya `Room.addListener` dan full-screen error saat initial connect.
- **Scenario:** WiFi loss, network handoff, 30s outage, sleep/wake.
- **Dampak:** user tidak tahu degraded/recovered state; support tidak dapat mendiagnosis “tidak dengar guru”.
- **Reproduce:** offline/online via browser; periksa UI/log/DB.
- **Rekomendasi:** state machine eksplisit dan structured diagnostics; bedakan recoverable/degraded/fatal; tampilkan restored banner sementara.
- **Test wajib:** fake room event sequence + browser network chaos.
- **Confidence:** High.

### PJJ-P1-003 — Flutter room in-flight dapat leak/race saat dispose atau retry

- **Severity:** P1
- **File:** `mobile/.../live_class_screen.dart:32-78,84-93,177-184`
- **Function/component:** `_connect`, `dispose`, retry
- **Root cause:** room baru dimasukkan ke `_room` setelah `connect()` selesai. Dispose saat prepare/connect tidak melihatnya. Retry tidak memiliki mutex/generation/cancellation dan tidak membersihkan failed room lokal.
- **Scenario:** user back saat connecting, rapid retry, network lambat.
- **Dampak:** zombie listener/peer connection, duplicate connection, CPU/battery leak, set state dari attempt lama.
- **Reproduce:** throttle network, buka room lalu back/retry berulang; inspeksi participant dan native WebRTC resources.
- **Rekomendasi:** ownership room sejak dibuat, single-flight connect, attempt generation/cancel flag, cleanup di setiap failure/finally.
- **Test wajib:** widget lifecycle test dengan delayed mocked connect.
- **Confidence:** High.

### PJJ-P1-004 — Lobby mobile palsu dan preferensi media diabaikan

- **Severity:** P1
- **File:** `student_app.dart:2199-2325`, `live_class_screen.dart:34-68`
- **Function/component:** `_StudentPjjLobbyScreen`, `_connect`
- **Root cause:** preview hanya avatar; toggle tidak diteruskan. Screen live meminta camera+mic dan selalu menyalakan mic, kamera selalu mulai off. Label koneksi “stabil” hard-coded.
- **Scenario:** siswa memilih mic off/camera on atau izin salah satu device ditolak.
- **Dampak:** privacy surprise, pilihan user tidak dihormati, izin yang tidak perlu memblokir flow, diagnosis jaringan menyesatkan.
- **Reproduce:** set mic off/camera on di lobby lalu join.
- **Rekomendasi:** pass immutable join preferences, real preview/permission state, jangan klaim network health tanpa measurement.
- **Test wajib:** matrix empat kombinasi preference dan permission denied.
- **Confidence:** High.

### PJJ-P1-005 — Chat tidak survive reconnect/join dan gagal kirim tetap tampak terkirim

- **Severity:** P1
- **File:** `live-chat-panel.tsx:28-82`
- **Function/component:** `LiveChatPanel`
- **Root cause:** state memory-only; data packets tidak dibuffer untuk disconnected receiver; optimistic item tidak memiliki status/retry; ordering lintas sender memakai timestamp client; callback unread berubah setiap parent render.
- **Scenario:** reconnect ketika pesan dikirim, late join, refresh, clock skew, 1,000+ rapid messages.
- **Dampak:** pesan hilang/urut salah, user percaya pesan gagal telah terkirim, UI update berfrekuensi tinggi.
- **Reproduce:** offline sesaat lalu send/recover; join participant baru; spam concurrent sender.
- **Rekomendasi:** backend persistence dengan server ID/timestamp/sequence + realtime notification; batched/virtualized rendering; delivery status dan dedupe server.
- **Test wajib:** 100/1k/5k, reconnect replay, duplicate/ordering, failed optimistic send.
- **Confidence:** High.

### PJJ-P1-006 — Whiteboard tidak memiliki source of truth atau recovery

- **Severity:** P1
- **File:** `live-whiteboard-panel.tsx:49-180`
- **Function/component:** `LiveWhiteboardPanel`
- **Root cause:** seluruh strokes hanya di ref client; reliable packet best-effort dan tidak tersimpan; late join/reconnect tidak menerima history; array stroke tidak dibatasi.
- **Scenario:** student reconnect, masuk terlambat, packet dikirim saat disconnected, sesi panjang.
- **Dampak:** papan berbeda antar peserta dan memory/redraw cost terus tumbuh.
- **Reproduce:** buat stroke, join participant baru; board baru kosong.
- **Rekomendasi:** authoritative snapshot/version + delta sequence; periodic compact snapshot; cap dan batch strokes; moderator clear via authorized backend.
- **Test wajib:** late join, missed delta, snapshot recovery, 10k strokes.
- **Confidence:** High.

### PJJ-P1-007 — Cancel tidak menghentikan room yang sudah live

- **Severity:** P1
- **File:** `sessions/[id]/route.ts:60-79`
- **Function/component:** cancel action
- **Root cause:** hanya mengubah DB status dan notifikasi; tidak menutup LiveKit room atau remove participant.
- **Scenario:** guru membatalkan sesi ketika peserta sudah connected.
- **Dampak:** user lama tetap dapat audio/video/data meskipun aplikasi menyatakan dibatalkan.
- **Reproduce:** join dua user, cancel dari dashboard, amati room tetap aktif.
- **Rekomendasi:** definisikan end/cancel semantics dan panggil RoomService deleteRoom/remove; audit event dan UI reason.
- **Test wajib:** cancel-before-start dan cancel-live E2E.
- **Confidence:** High.

### PJJ-P1-008 — Tidak ada production observability

- **Severity:** P1
- **File:** seluruh PJJ; schema `connectionQuality` tidak digunakan
- **Function/component:** logging/telemetry
- **Root cause:** tidak ada client session ID, structured event schema, sampling, metrics, atau redaction pipeline.
- **Scenario:** laporan missing audio/video, reconnect, device failure.
- **Dampak:** MTTR tinggi dan acceptance target tidak dapat diukur.
- **Reproduce:** cari event sink/metrics; tidak ada.
- **Rekomendasi:** implementasi desain di remediation/test plan dengan token redaction dan correlation ID.
- **Test wajib:** logger redaction/schema/unit; synthetic alert validation.
- **Confidence:** High.

### PJJ-P1-009 — Tidak ada automated PJJ tests

- **Severity:** P1
- **File:** `package.json`, web test tree, Flutter test tree
- **Function/component:** CI/test architecture
- **Root cause:** web tidak memiliki test runner/E2E dependency atau script PJJ; Flutter hanya general/golden tests.
- **Scenario:** perubahan lifecycle, permission, webhook, reconnect.
- **Dampak:** regression critical tidak terdeteksi sebelum production.
- **Reproduce:** inventaris scripts/test files.
- **Rekomendasi:** implementasikan pyramid di `pjj-test-plan.md` sebelum klaim readiness.
- **Test wajib:** seluruh plan.
- **Confidence:** High.

### PJJ-P1-010 — Mobile background audio/recovery belum dikonfigurasi

- **Severity:** P1
- **File:** `ios/Runner/Info.plist`, Android manifest, `live_class_screen.dart`
- **Function/component:** app lifecycle/platform config
- **Root cause:** tidak ada iOS `UIBackgroundModes: audio`, Android foreground-service/lifecycle handling, atau app pause/resume diagnostics.
- **Scenario:** lock screen, app background/foreground, sleep/wake.
- **Dampak:** audio/session dapat berhenti atau state UI stale.
- **Reproduce:** background app ketika meeting pada iOS/Android.
- **Rekomendasi:** tentukan product policy background; implement platform requirement dan lifecycle tests bila audio background diwajibkan.
- **Test wajib:** physical-device background/foreground matrix.
- **Confidence:** Medium; behavior final perlu device test.

## P2 — Medium

### PJJ-P2-001 — Preview web menggabungkan izin mic/camera

- **Severity:** P2
- **File:** `live-join-lobby.tsx:37-114`
- **Function/component:** preview effects
- **Root cause:** satu `getUserMedia` untuk kedua device; error tidak diklasifikasikan; dua effect dapat mengulang acquisition setelah failed join.
- **Scenario:** camera denied tetapi mic tersedia, device unplug, constraint gagal.
- **Dampak:** pesan ambigu dan preview tidak menunjukkan device yang masih usable.
- **Reproduce:** deny camera, allow microphone.
- **Rekomendasi:** acquire/diagnose per kind atau gunakan LiveKit `PreJoin`; expose device selector dan permission state.
- **Test wajib:** DOM/media mocks untuk NotAllowed/NotFound/NotReadable/Overconstrained.
- **Confidence:** High.

### PJJ-P2-002 — Polling dapat overlap dan stale response menang

- **Severity:** P2
- **File:** `live-class-room-client.tsx:210-229`, `live-attendance-panel.tsx:42-62`
- **Function/component:** badge/roster polling
- **Root cause:** interval memulai fetch baru tanpa AbortController/single-flight/sequence guard.
- **Scenario:** API >12/15 detik atau network handoff.
- **Dampak:** request buildup, stale UI, beban DB dikalikan participant.
- **Reproduce:** delay endpoint 30 detik.
- **Rekomendasi:** server push/invalidation, single-flight polling fallback, abort on unmount.
- **Test wajib:** fake timer + out-of-order response.
- **Confidence:** High.

### PJJ-P2-003 — Participant/roster UI belum virtualized dan terlalu mudah rerender

- **Severity:** P2
- **File:** `live-participants-panel.tsx`, `live-attendance-panel.tsx`, `RoomHeaderMeta`
- **Function/component:** list and participant hooks
- **Root cause:** map seluruh peserta; `useParticipants()` default updates pada event participant termasuk speaking/track state; header hanya membutuhkan count tetapi subscribe ke array penuh.
- **Scenario:** 100-500 participants, active speaker churn.
- **Dampak:** React rerender/DOM cost dan input lag.
- **Reproduce:** simulated participants + React Profiler.
- **Rekomendasi:** count-specific observer, memoized row, virtualization/content-visibility, batched low-priority updates.
- **Test wajib:** profiler budget dan 500-row component benchmark.
- **Confidence:** High.

### PJJ-P2-004 — Questions count hanya menghitung page pertama

- **Severity:** P2
- **File:** `questions/route.ts:26-41`
- **Function/component:** questions `GET`
- **Root cause:** `take: 100`, kemudian `openCount` dihitung dari hasil itu, bukan DB count.
- **Scenario:** >100 questions.
- **Dampak:** badge dan antrean moderator salah.
- **Reproduce:** buat 101+ pertanyaan terbuka.
- **Rekomendasi:** query count terpisah, pagination/cursor, virtualized list.
- **Test wajib:** 101/5,000 question integration test.
- **Confidence:** High.

### PJJ-P2-005 — Dua chat UI berbeda aktif di web

- **Severity:** P2
- **File:** `VideoConference` + `LiveChatPanel`
- **Function/component:** built-in ControlBar chat dan custom Chat tab
- **Root cause:** prefab `VideoConference` mengaktifkan chat bawaan sementara aplikasi menambah protocol/UI chat custom.
- **Scenario:** user membuka chat dari control bar dan tab aplikasi.
- **Dampak:** dua riwayat/protocol terpisah dan perilaku membingungkan.
- **Reproduce:** gunakan kedua tombol chat.
- **Rekomendasi:** pilih satu UI/protocol dan matikan yang lain.
- **Test wajib:** one-chat-surface component/E2E.
- **Confidence:** High berdasarkan source komponen versi terpasang.

### PJJ-P2-006 — Speaker output dan device-change recovery tidak eksplisit

- **Severity:** P2
- **File:** web room UI dan `live_class_screen.dart`
- **Function/component:** device management
- **Root cause:** web control hanya input menus; mobile tidak menawarkan selector atau event-specific recovery.
- **Scenario:** cabut headset, default output berubah, Bluetooth handoff.
- **Dampak:** audio dapat keluar dari device yang salah tanpa diagnosis.
- **Reproduce:** headset/Bluetooth matrix.
- **Rekomendasi:** feature-detect output selection, listen media device changes, expose current selection and recovery hint.
- **Test wajib:** browser/device lab; mock devicechange unit tests.
- **Confidence:** Medium karena output switching bergantung platform/browser.

## P3 — Low

### PJJ-P3-001 — Error taxonomy dan response status tidak konsisten

- **Severity:** P3
- **File:** token/moderation/attendance routes dan clients
- **Function/component:** catch blocks
- **Root cause:** banyak exception server dikembalikan sebagai 400 dan client menampilkan raw `Error.message`; beberapa broadcast failure diabaikan.
- **Scenario:** DB/provider outage versus invalid input.
- **Dampak:** alerting dan UX recovery tidak akurat.
- **Reproduce:** force provider 502/DB error.
- **Rekomendasi:** typed error codes `RECOVERABLE/DEGRADED/FATAL`, stable public messages, internal structured cause.
- **Test wajib:** error mapping table tests.
- **Confidence:** High.

### PJJ-P3-002 — Virtual background tidak ada

- **Severity:** P3 (feature gap, bukan active defect)
- **File:** tidak ditemukan implementation di PJJ web/mobile
- **Function/component:** N/A
- **Root cause:** belum diimplementasikan.
- **Scenario:** user mengharapkan blur/image background.
- **Dampak:** feature tidak tersedia; kasus subject hilang tidak dapat diaudit runtime.
- **Reproduce:** tidak ada control/API/processor.
- **Rekomendasi:** jangan enable sebelum processor lifecycle, fallback normal camera, capability/performance gate, dan test plan tersedia.
- **Test wajib:** segmentation/fallback/camera switch/reconnect/CPU matrix ketika fitur dibuat.
- **Confidence:** High.

## Acceptance gate

Sistem baru boleh disebut production-ready setelah semua P0 dan P1 ditutup, suite PJJ hijau, dan load/chaos test memenuhi:

- Join success >=99.9% pada healthy supported network; p95 join <=5s web dan <=7s mobile.
- 0 phantom online, 0 double-count join, 0 duplicate participant tile/audio.
- Reconnect success >=99% untuk outage 1-10s dan >=95% untuk outage 30s dalam test matrix; media pulih <=10s setelah `Reconnected` p95.
- Audio/video subscription success >=99.9% untuk required presenter tracks; missing media persisten 0.
- Tidak ada unauthorized privileged packet yang diterima.
- Repeated 50x join/leave tidak meninggalkan listener/track/peer connection; heap growth setelah GC <=10% dari steady baseline.
- Chat 5,000 pesan tidak freeze; input task p95 <100ms; replay/dedupe benar.
- Capacity ditolak secara deterministik saat penuh.
- Tidak ada token/secret/credential dalam log.
- Kelas besar memenuhi profile publisher/subscriber yang didefinisikan, bukan sekadar 500 websocket connected.

