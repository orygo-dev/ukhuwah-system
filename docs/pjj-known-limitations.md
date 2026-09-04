# PJJ Known Limitations

- Audit source tidak membuktikan kapasitas LiveKit Cloud tenant, region placement, TURN reachability, firewall compatibility, atau purchased quota. Itu harus diverifikasi di test project/Cloud dashboard dan load test.
- Mode **MEETING** dibatasi `PJJ_SAFE_MEETING_MAX_PARTICIPANTS = 25` (all-publish meeting profile). Mode **CLASSROOM** dibatasi `PJJ_SAFE_CLASSROOM_MAX_PARTICIPANTS = 100` dengan siswa default non-publisher; hanya guru/screen share + siswa yang di-promote yang masuk strip video. Classroom 100 ≠ broadcast all-viewer 250/500.
- Kelas 250/500 hanya realistis sebagai classroom/broadcast dengan publisher dan subscriptions terbatas. Aplikasi tidak menjamin 500 participant all-camera/all-mic.
- Kuis berpoin in-live (B2) terpisah dari bank `Quiz` kelas: MCQ saja, satu kuis LIVE per sesi, skor persen 0–100, tidak otomatis masuk rapor kuis kelas.
- LiveKit reliable data packet bersifat best-effort saat receiver temporarily disconnected dan tidak menyediakan history. Chat/whiteboard/kuis yang hanya memakai packet tidak dapat dijamin recoverable tanpa persistence aplikasi (kuis/chat memakai DB sebagai source of truth).
- Browser speaker-output selection bergantung dukungan `setSinkId`/platform. Safari/iOS dan device Bluetooth memerlukan physical-device testing.
- Network handoff, background audio, Bluetooth, sleep/wake, dan OS permission behavior tidak dapat divalidasi penuh melalui unit/browser automation.
- Virtual background belum diimplementasikan. Tidak ada jaminan segmentation, fallback, atau CPU budget sampai feature tersebut dibuat dan diuji.
- Mobile PJJ memiliki overlay kuis live dan policy classroom (non-publish default), tetapi belum memiliki persistent real chat UI setara web, screen share student, atau explicit speaker/device selector. Lobby camera preview dan join preferences sudah diimplementasikan tetapi masih memerlukan physical-device validation.
- Recording flag tersimpan dalam konfigurasi tetapi source audit tidak menemukan egress/recording orchestration; recording tidak boleh dianggap tersedia.
- End-to-end encryption tidak dikonfigurasi; media menggunakan transport security LiveKit/WebRTC tetapi bukan application-configured E2EE.
- Analisis Dart terarah untuk layar live dan alur siswa sudah lulus. Analisis penuh seluruh aplikasi Flutter tetap perlu dijalankan di CI/runner yang stabil.
- Whiteboard source sudah memiliki snapshot/delta persistence, compaction, dan reconnect hydration. Migrasinya belum memiliki bukti staging dan real-room concurrency tetap harus diuji.
- Diagnostics web sudah menghasilkan structured application logs, tetapi belum terhubung ke metrics backend, dashboard, retention, dan alerting produksi.
- Migrasi `202608110001_pjj_chat_messages` dan `202608210001_pjj_classroom_quiz` wajib dijalankan melalui prosedur release sebelum fitur chat persisten / classroom+kuis live dipakai di staging/produksi.
