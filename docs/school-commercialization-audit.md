# Audit Fase 0–8 Komersialisasi Sekolah

Tanggal: 27 Agustus 2026

## Keputusan

**PASS FOR MERGE — FEATURE FLAG OFF.** Perubahan aman digabung karena migration additive, fitur sekolah fail-closed, dan menu/credit/billing lama tidak berubah saat flag OFF.

**NOT YET APPROVED FOR PILOT ENABLEMENT.** Database MySQL lokal pada `localhost:3306` tidak tersedia, sehingga migration deploy, transaksi DB nyata, AI provider nyata, dan PJJ LiveKit nyata tidak diuji dalam audit lokal ini. Runbook mewajibkan staging backup dan runtime validation sebelum flag dinyalakan.

## Verifikasi fase

| Fase | Scope | Hasil | Evidence |
|---|---|---|---|
| 0 | Arsitektur, isolation boundary, feature flag, baseline | PASS | Dokumen arsitektur/runbook/test plan; flag server dan client default OFF |
| 1 | Paket sekolah dan subscription lifecycle | PASS (source/build) | Model baru, deadline-aware status, rekonsiliasi harian |
| 2 | Seat, effective access, audit, expiry/read-only | PASS (source/build) | Tenant check, seat limit transaction serializable, audit trail |
| 3 | Dokumen admin, branding data, version, approval, archive, export | PASS (source/build) | State machine, optimistic version, PDF/DOCX hanya approved/archived |
| 4 | Jadwal | PASS | Constraint engine menolak benturan guru/kelas/ruang; tests PASS |
| 5 | Program kerja, kalender, notulen, laporan, supervisi | PASS (source/build) | Jenis dokumen terstruktur, kalender, laporan menghitung data DB aktual; AI selalu draft |
| 6 | Kredit, ledger, invoice, pembayaran manual dan checkout mandiri terisolasi | PASS (source/build) | CAS, saldo non-negatif, transaksi sekolah terpisah, webhook idempoten, tabel billing pribadi tidak diubah |
| 7 | PJJ entitlement/metering/cap | PASS (source/build) | Add-on school, commercial hard cap 25, webhook metering idempoten, 40 regression PJJ PASS |
| 8 | Pilot control, observability, ops, rollback | PASS | Flag OFF, health endpoint, reconcile script, runbook rollout dan rollback |

## Hasil test

- Prisma format: PASS.
- Prisma validate: PASS.
- `test:school-commercialization`: 18/18 PASS.
- Regression PJJ: 40/40 PASS.
- Regression auth/HTTP/reading/upload: 19/19 PASS.
- Regression MCQ: 3/3 PASS.
- Total automated tests yang dijalankan pada perubahan ini: 80 PASS, 0 FAIL.
- TypeScript `tsc --noEmit`: PASS.
- Next.js production build: PASS; 113 halaman berhasil digenerate.
- Smoke HTTP tanpa kredensial: `/login` 200, API sekolah saat flag OFF 404, API admin tanpa auth 403.
- Browser target `/school/subscription` tidak dapat divalidasi sebagai Admin Sekolah pada workstation ini: sesi browser yang tersedia adalah akun guru dan MySQL lokal `localhost:3306` tidak berjalan. Browser diarahkan ke `/dashboard`; tidak ada klaim PASS untuk E2E pembayaran nyata.

Warning build yang tersisa berada pada file lama notifikasi dan Zona Baca (`no-img-element` dan unused variable); bukan regresi fase 0–8 dan tidak memblokir build.

## Temuan audit dan perbaikan

1. Tiga nama index jadwal awal melebihi batas identifier MySQL 64 karakter. Nama dipendekkan di Prisma dan migration, lalu ditambahkan regression assertion.
2. Reset form setelah `await` berpotensi kehilangan `currentTarget`. Referensi form kini disimpan sebelum network call.
3. Konflik serializable webhook (`P2034`) sebelumnya dapat berakhir sebagai 401. Kini mengembalikan 503 + `Retry-After` agar LiveKit melakukan retry aman.
4. Status subscription yang dapat menulis kini wajib memiliki tanggal akhir saat aktivasi.
5. Admin Sekolah tanpa subscription sebelumnya tidak dapat melihat katalog. Endpoint billing tenant-scoped kini tidak mensyaratkan subscription, sementara seluruh fitur berbayar tetap fail-closed.
6. Checkout sekolah kini memiliki lock unik per sekolah, idempotency request, provider reference terpisah, validasi amount/signature, aktivasi serializable, invoice otomatis, refund handling, dan expiry cleanup.
7. Downgrade tidak lagi menyisakan seat melebihi limit; seat paling lama dipertahankan dan sisanya dilepas dengan audit.

## Race condition

- Credit: compare-and-swap terhadap saldo subscription, maksimal lima retry, unique idempotency key, dan transaksi yang sama dengan pembuatan dokumen.
- Seat: count dan assignment dalam transaksi serializable; unique subscription/user.
- Document/schedule: `expectedVersion` dan `updateMany` CAS; stale writer mendapat 409.
- Webhook: receipt event unik, transaksi serializable, stale SID guard, dan retry 503 untuk serialization conflict.
- Invoice number dan document number dilindungi unique constraint.
- Checkout: unique active checkout per sekolah, unique idempotency key, dan CAS callback `PENDING → PAID`; duplicate webhook tidak menggandakan masa aktif atau kredit.

## Memory dan resource cleanup

- Tidak ada interval/polling baru di halaman administrasi atau subscription.
- Fetch hanya terjadi saat mount dan setelah mutation; tidak ada request loop.
- Request checkout gateway dibatasi 20 detik memakai `AbortSignal`; kegagalan definitif melepas checkout lock dan membatalkan invoice, sedangkan timeout ambigu tetap pending agar webhook terlambat masih dapat menyelesaikan transaksi.
- Script rekonsiliasi menutup Prisma di `finally`.
- Server lokal audit dihentikan setelah smoke test sehingga binary Prisma tidak tertahan.
- Export membuat buffer per request tanpa menyimpan global state.

## File/area lama yang dijaga

- `SubscriptionPlan`, `Transaction`, `Document`, dan `CreditLedger` tidak dimigrasi atau dihapus.
- Mobile workspace tidak disentuh dan perubahan lokal mobile tidak dimasukkan commit.
- Generator pribadi tetap memakai saldo pribadi kecuali user memiliki seat sekolah aktif dan flag server dinyalakan; sumber kredit dikembalikan eksplisit dalam response.
- PJJ existing tetap memakai policy sebelumnya ketika fitur sekolah nonaktif.

## Residual risk / runtime wajib sebelum pilot

1. Jalankan migration pada database staging yang sudah dibackup dan periksa index/FK aktual.
2. Uji dua request kredit paralel terhadap sisa satu kredit pada MySQL nyata.
3. Uji AI provider gagal/sukses, PDF/DOCX dapat dibuka, dan approval multi-browser.
4. Uji LiveKit nyata 1–25 peserta, peserta ke-26 ditolak server, retry/duplicate webhook, dan metering.
5. Uji browser sebagai Super Admin, Admin Sekolah, guru dengan seat, guru tanpa seat, serta status expired/read-only.
6. Tetapkan harga dan limit paket bisnis resmi sebelum membuat paket aktif.
7. Jalankan pembayaran sandbox nyata Midtrans/Tripay untuk bulanan, tahunan, gagal, kedaluwarsa, duplicate webhook, refund, upgrade/downgrade, dan pastikan URL webhook publik tetap mengarah ke deployment yang benar.

Tidak ada credential, deployment production, migration database, atau perubahan data eksternal yang dilakukan dalam audit ini.
