# Test Plan Paket Sekolah

## Otomatis

- Prisma format, validate, dan generate.
- `npm run test:school-commercialization`: fail-closed flag, expiry/grace/read-only, merge entitlement, cap 25, benturan jadwal, migration additive, CAS/idempotency kredit, optimistic locking, dan isolasi kredit pribadi/sekolah.
- Self-service billing: katalog sebelum subscription, pemilihan harga bulanan/tahunan, tabel transaksi terisolasi, satu checkout pending per sekolah, webhook signature/amount, callback idempoten, refund, dan penyesuaian seat saat downgrade.
- `npm run test:pjj`: regression seluruh policy, token, webhook, attendance, state, migration, dan readiness PJJ lama.
- Seluruh test lain yang tersedia: auth cookie, HTTP JSON, generator MCQ, reading, dan upload URL.
- `npm run build`: TypeScript, lint, route compilation, dan production bundle.

## Runtime pilot

1. Flag OFF: login seluruh role, generator pribadi, billing pribadi, admin sekolah, PJJ, Zona Baca, dan mobile API tetap berfungsi.
2. Flag ON tanpa subscription: menu dapat terlihat tetapi API fail-closed.
   Endpoint billing merupakan pengecualian yang disengaja: katalog paket dan checkout dapat dibuka oleh Admin Sekolah tanpa subscription, tetapi tetap wajib tenant dari session server.
3. Subscription aktif: seat sampai batas PASS; seat kelebihan ditolak; guru luar sekolah ditolak.
4. Kredit: AI sukses mengurangi saldo sekolah saja; provider gagal tidak mengurangi saldo; retry/idempotent tidak menagih dua kali; paralel pada sisa satu kredit hanya satu yang sukses.
5. Dokumen: AI/manual selalu draft; transisi ilegal ditolak; stale version mendapat 409; ekspor sebelum approval ditolak; PDF/DOCX approved dapat dibuka.
6. Jadwal: benturan guru/kelas/ruang ditolak; adjacent periods diterima; stale save/publish mendapat 409.
7. Expiry: trial/active/grace sesuai deadline; read-only masih dapat membaca dan mengekspor approved document tetapi tidak dapat menulis.
8. PJJ add-on: 1–25 diterima sesuai policy runtime, 26 ditolak secara server-side; duplicate/retry webhook tidak menggandakan attendance atau metering.
9. Resource: tidak ada pertumbuhan koneksi DB, timer browser, listener, atau memory tanpa batas setelah 100 operasi berulang.

Hasil runtime yang memerlukan credential/provider/perangkat nyata harus dicatat sebagai `NOT TESTED`, bukan diasumsikan PASS.
