# Guru Space — Production Readiness Audit

Tanggal audit: 27 Agustus 2026

Branch: `cursor/fix-teacher-student-account-flow`

Keputusan saat ini: **NOT READY (runtime deployment belum diverifikasi)**

## Ringkasan

Source, dependency, schema, dan production build telah diaudit. Temuan source berisiko tinggi yang dapat diperbaiki tanpa akses environment telah diperbaiki dan diuji. Aplikasi belum boleh dinyatakan siap produksi sampai migration serta alur runtime terautentikasi berhasil diuji pada database dan layanan nyata.

## Temuan dan perbaikan

| ID | Temuan / root cause | Perbaikan | Evidence | Status |
|---|---|---|---|---|
| AUTH-01 | JWT menyimpan role/scope lama; perubahan password atau role tidak mencabut sesi lama. | Tambah `users.auth_version`, increment pada perubahan sensitif, dan validasi ulang user/role/school/student aktif dari database pada setiap `auth()`. Token lama fail-closed. Redirect login pada proxy diubah agar cookie yang sudah dicabut tidak membuat redirect loop. | `test:security`, TypeScript, production build | PASS (source) |
| AUTH-02 | Login utama/mitra/OTP/reset/orang tua tidak memiliki rate-limit persisten yang seragam; portal orang tua memakai `Map` proses. | Rate-limit SHA-256 berbasis database, transaksi `SERIALIZABLE`, retry konflik `P2002/P2034`, `Retry-After`, dan pembersihan record kedaluwarsa. | `test:security` | PASS (source) |
| SEC-01 | Halaman login default membocorkan akun dan password demo, termasuk Super Admin; seed dapat membuat akun tersebut tanpa guard. | Hapus credential dari branding/fallback, sanitasi konfigurasi legacy sebelum dipublikasikan, seed membutuhkan `ALLOW_DEMO_SEED=true`, serta sediakan penggantian password mandiri dengan verifikasi password lama dan revokasi sesi. | Browser menemukan reproduksi; `test:security` membuktikan source tidak mengekspos nilai tersebut | PASS (source) |
| AUTH-03 | Super Admin tidak dapat mengganti password sendiri atau membuat Super Admin cadangan melalui UI. | Tambah menu `Akun & Keamanan`, endpoint password dengan verifikasi bcrypt dan policy kuat, serta opsi pembuatan Super Admin yang hanya dapat dipanggil Super Admin terautentikasi. | `test:security`, TypeScript, production build | PASS (source) |
| AUTH-04 | Regresi setelah AUTH-01: `/api/auth/session` masih mengembalikan user dari cookie yang ditolak wrapper `auth()`, sementara Android mengabaikan bootstrap 401. Refresh/backfill JWT juga dapat menaikkan versi token yang dicabut. | Validasi versi/user/siswa aktif di callback JWT; kembalikan null agar Auth.js menghapus cookie. Versi hanya diterbitkan saat login kredensial, tidak dipromosikan saat refresh. Android membersihkan sesi yang ditolak dan kembali ke login. | 12 test callback/Auth.js runtime terisolasi, 4 test repository Flutter; detail insiden di bawah | PASS (local); deployment/device verification PENDING |
| SEC-02 | Respons belum memiliki baseline header keamanan. | Nonaktifkan `X-Powered-By`; tambah nosniff, anti-frame, referrer policy, permissions policy yang tetap mengizinkan kamera/mikrofon same-origin, COOP popup-safe, dan HSTS production. | `test:security`, production build | PASS (source) |
| DEP-01 | `npm audit` awal: 14 vulnerability (7 high), termasuk advisory Next.js. | Upgrade Next.js 16.3.3, ESLint config/PostCSS, refresh dependency lock, dan override transitive aman yang sudah diverifikasi Prisma. | `npm audit --omit=dev`: 0 vulnerability; production build PASS | PASS |
| BOUNDARY-01 | Komponen Zona Baca client mengimpor modul yang juga mengimpor auth/Prisma server. | Pisahkan constant/label browser-safe ke `reading-shared.ts`; auth/database tetap pada server graph. | Next.js 16 production build | PASS |
| API-01 | Quota Provider API memakai check-then-increment sehingga request paralel dapat melampaui quota; autentikasi membaca seluruh client. | Gunakan atomic conditional `updateMany` + increment dalam transaksi yang sama dengan usage log; duplicate request dipetakan 409; API key memakai unique lookup. | `test:security`, TypeScript, build | PASS (source) |
| PERF-01 | Endpoint directory publik memuat sampai 5.000 sekolah dan seluruh kabupaten pada request awal registrasi. | Request awal hanya memuat provinsi; kabupaten dimuat setelah provinsi, sekolah setelah kabupaten/search; hasil sekolah maksimal 100 dan query dibatasi. | `test:security`, build | PASS (source) |

## Perubahan database

Migration aditif: `202608270003_security_hardening`

- `users.auth_version INTEGER NOT NULL DEFAULT 0`
- tabel `security_rate_limits`
- index bucket dan expiry untuk throttling/cleanup

Migration tidak menghapus atau mengubah data bisnis eksisting. Migration **belum dijalankan** dari workstation audit karena MySQL `localhost:3306` tidak tersedia.

## Hasil test

| Pemeriksaan | Hasil |
|---|---|
| Prisma schema validate/generate | PASS |
| TypeScript `tsc --noEmit` | PASS |
| Next.js 16.3.3 production build (113 pages, setelah perbaikan AUTH-04) | PASS |
| PJJ tests | 40/40 PASS |
| School commercialization tests | 18/18 PASS |
| MCQ tests | 3/3 PASS |
| Security regression tests (termasuk 12 test runtime sesi AUTH-04) | 23/23 PASS |
| Flutter session recovery + app variant + PJJ lifecycle | 10/10 PASS |
| Flutter analyze repository auth dan test sesi | PASS, no issues |
| Dependency audit | 0 vulnerability |
| Database migration status | BLOCKED — MySQL lokal tidak berjalan |
| Full/classroom/parent DB audit | BLOCKED — MySQL lokal tidak berjalan |
| Authenticated browser E2E semua role | BLOCKED — tidak ada database runtime yang dapat diakses |
| Real LiveKit/payment/WhatsApp callback | NOT TESTED pada audit ini |

## Race condition dan resource cleanup

- Rate-limit menggunakan transaksi serializable dan retry bounded; state tidak hilang saat PM2 restart dan dapat dipakai multi-instance.
- Record rate-limit lama dibersihkan secara low-frequency setelah melewati expiry 24 jam.
- Revokasi siswa mengubah password, memutus relasi roster, dan menaikkan `auth_version` dalam alur transaksi yang sudah ada.
- Provider quota menggunakan compare-and-increment atomik; transaksi usage log menggagalkan increment apabila log duplicate/gagal.
- Endpoint directory publik tidak lagi mengalokasikan response ribuan sekolah pada load awal.

## Residual risk / gate produksi

Status tetap **NOT READY** sampai seluruh gate berikut memiliki evidence runtime:

1. Backup database target dan verifikasi target bukan database yang tidak sengaja akan ditimpa.
2. Server memakai Node.js minimal 20.9 (syarat Next.js 16), lalu `npm ci` berhasil.
3. `npx prisma migrate status`, `npx prisma migrate deploy`, dan pemeriksaan kolom/index aktual PASS.
4. Semua akun yang pernah memakai password demo dirotasi melalui menu Super Admin **Akun & Keamanan**. Akun lama tetap dapat login agar tidak terjadi lockout, tetapi deployment belum boleh dianggap aman sebelum rotasi selesai.
5. Login/logout dan perubahan password/role diuji; sesi sebelum perubahan harus menerima 401/redirect login.
6. E2E role Super Admin, Admin Sekolah, Guru, Siswa, Orang Tua, dan Mitra PASS dengan isolasi tenant/sekolah.
7. Midtrans/Tripay sandbox callback bertanda tangan, duplicate callback, amount mismatch, dan status payment PASS.
8. LiveKit staging nyata, webhook, reconnect, 25 participant, dan participant ke-26 rejection mengikuti `docs/pjj-runtime-validation.md` dan PASS.
9. Upload ebook besar diuji melewati proxy/CDN aktual tanpa 524 dan tanpa lonjakan memory tidak terkendali.
10. Setelah deploy: cek header keamanan, PM2 restart count/log, health/smoke, serta rollback point.

## Keputusan

Perbaikan source yang ditemukan pada audit ini telah lulus test dan build. Namun, tanpa migration dan runtime E2E pada environment yang benar, keputusan yang dapat dipertanggungjawabkan adalah:

**NOT READY**

## Insiden sesi Android / kolom port PM2 — 27 Agustus 2026

### Reproduksi dan root cause

Sebelum fix, 7 dari 9 test baru gagal ketika callback asli `src/lib/auth.ts`
dijalankan melalui Auth.js dengan JWT terenkripsi dan request HTTP sintetis.
Database diganti fixture, bukan database produksi. Cookie legacy/telah dicabut
masih menghasilkan user pada endpoint session, walaupun protected API menolak
cookie yang sama. `trigger=update` dan backfill membership dapat menyalin versi
database ke cookie lama, sehingga revokasi juga tidak konsisten.

Di Flutter, 2 dari 4 test awal gagal: bootstrap 401 tetap menghasilkan AppUser,
dan sesi kosong tidak membersihkan cookie. Ini menjelaskan dashboard yang tetap
terbuka tetapi semua permintaan menerima “Sesi login tidak valid”.

### File berubah dan verifikasi

- `src/lib/auth.ts`: validasi authoritative pada callback JWT untuk session GET
  maupun update; token tanpa versi/mismatch, user hilang, atau siswa nonaktif
  menghasilkan null. Metadata diperbarui dari database tanpa menaikkan versi JWT.
- `mobile/guruspace_mobile/lib/features/auth/data/auth_repository.dart`: cookie
  dibersihkan ketika endpoint session kosong atau bootstrap 401; network/503
  sementara tetap mempertahankan fallback sesi yang ada.
- `tests/security/session-runtime.test.ts`: 12/12 PASS setelah fix, termasuk
  fresh sign-in callback, teacher/student valid, legacy/revoked session,
  deleted user, inactive student, update/backfill, parallel reads, database
  failure, password-change race, dan penghapusan semua chunk cookie.
- `mobile/guruspace_mobile/test/auth_session_recovery_test.dart`: 4/4 PASS.
- Dokumen ini diperbarui; tidak ada perubahan port, PM2, proxy, secret, schema,
  password, maupun data pengguna pada perbaikan insiden ini.

Build Next.js 16.3.3 beserta TypeScript PASS. Security 23/23, PJJ 40/40,
school commercialization 18/18, MCQ 3/3, dan Flutter 10/10 PASS.
Flutter analyze file auth/test PASS. Flutter test awal terhalang apostrof pada
path Windows; dijalankan melalui alias drive lokal tanpa mengubah kode SDK.
Test ini bukan pengujian login pada Android fisik atau database server nyata.

### Race dan resource

Versi JWT tidak dinaikkan saat refresh, termasuk bila password berubah tepat
setelah pembacaan database. Token yang sedang diproses dapat membawa snapshot
lama, tetapi tetap versi lama dan ditolak pada validasi berikutnya; wrapper
protected API tetap memeriksa database. Tidak ada retry tak terbatas atau cache
sesi per proses. Auth.js menghapus cookie beserta semua chunk-nya ketika sesi
ditolak. Flutter menghapus persisted cookie pada restore yang ditolak.

Tambahan biaya: session endpoint membaca user dari database (dan profil siswa
untuk role siswa). Wrapper protected API tetap melakukan pemeriksaan ulang;
latensi/load database nyata belum diukur. Error database fail-closed sesuai
perilaku Auth.js; pengguna mungkin perlu login kembali setelah database pulih.

### Status server / langkah pemulihan

Pemeriksaan HTTP publik tanpa cookie saat penanganan insiden:
`https://guruspaceai.cloud/login` = 200,
`https://guruspaceai.cloud/api/auth/session` = 200.
Ini hanya membuktikan endpoint publik merespons, bukan keberhasilan login atau
port/socket PM2 tertentu. `ecosystem.config.cjs` tetap menetapkan `PORT=3000`.
Output server yang kemudian diberikan pengguna mengonfirmasi Node 24.18.0,
Next.js 16.3.3, PM2 `guruspace` id 5 online dengan uptime 13 menit,
socket `*:3000` LISTEN, dan curl loopback `/login` HTTP 200.
Startup/listener pada snapshot tersebut **PASS**; kolom port UI kosong bukan
bukti server mati. Total restart 9.424 adalah angka kumulatif, bukan bukti
restart loop saat ini (unstable restarts 0). Jangan pindahkan port atau restart
aplikasi lain berdasarkan kolom UI tersebut saja.

Log memuat `CredentialsSignin` serta konflik/deadlock
`securityRateLimit.create()`. Pembatas login memiliki retry bounded; log tanpa
timestamp/request correlation belum membuktikan retry habis atau penyebab
penolakan login tertentu. Login kredensial nyata tetap perlu diverifikasi;
jangan menganggap perbaikan sesi ini membuktikan seluruh penolakan login pulih.

Perbaikan ini belum di-deploy dari workstation. Deployment memerlukan build
berhasil dan migration keamanan `202608270003_security_hardening` dari rilis
sebelumnya sudah terpasang. Jangan menjalankan reset database/seed, mengganti
AUTH_SECRET, atau melonggarkan authVersion untuk memulihkan sesi lama.

Setelah backend diperbarui, tutup lalu buka kembali Android dan login kembali
dengan akun yang sama. APK yang sudah terpasang membaca session endpoint saat
restore, sehingga seharusnya menerima sesi kosong dan menampilkan login;
verifikasi perangkat tetap wajib. Perubahan repository Flutter baru akan
tersedia di perangkat setelah APK diperbarui.

Status perbaikan lokal: **PASS**. Startup/listener server pada output pengguna:
**PASS**. Deployment patch serta login server/Android fisik: **NOT VERIFIED**,
bukan selesai hanya berdasarkan build/test lokal.
