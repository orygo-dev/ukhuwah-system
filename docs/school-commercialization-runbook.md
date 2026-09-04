# Runbook Paket Sekolah

## Preflight wajib

1. Pastikan target bukan production saat uji migration pertama.
2. Backup database dan simpan bukti restore point.
3. Pastikan kedua feature flag masih `false`.
4. Jalankan `npx prisma migrate status` dan simpan output.
5. Jalankan `npm ci`, `npx prisma generate`, test, dan build.

## Deployment pilot

1. Jalankan `npx prisma migrate deploy`.
2. Verifikasi tabel `school_*`, termasuk `school_payment_transactions`, foreign key, serta unique index idempotency/gateway/active checkout.
3. Deploy aplikasi dengan kedua flag masih `false`; smoke-test login dan seluruh menu lama.
4. Buat paket di Super Admin → Paket Sekolah. Tentukan harga/limit resmi; jangan mengandalkan nilai asumsi.
5. Aktifkan subscription hanya untuk sekolah pilot.
6. Set `SCHOOL_COMMERCIALIZATION_ENABLED=true` dan `NEXT_PUBLIC_SCHOOL_COMMERCIALIZATION_ENABLED=true`, build ulang, lalu restart aplikasi.
7. Uji admin sekolah, seat guru, generator pribadi, generator seat sekolah, approval/ekspor, jadwal, kalender, invoice, dan PJJ maksimal 25.
   Untuk pembayaran mandiri, uji paket bulanan dan tahunan, callback valid/invalid, nominal salah, duplicate callback, pembayaran gagal/kedaluwarsa/refund, perpanjangan, upgrade, dan downgrade.
8. Jadwalkan `npm run school:reconcile-subscriptions` sekali sehari dengan lock agar tidak ada dua proses scheduler aktif. Idempotency ledger tetap menjadi pertahanan kedua.
9. Pantau `/api/admin/school-commercialization/health` sebagai Super Admin.

## Alur pembayaran sekolah

1. Super Admin membuat dan mengaktifkan paket sekolah serta mengatur Midtrans atau Tripay sebagai gateway default.
2. Admin Sekolah membuka **Paket Sekolah**, memilih periode, lalu menyelesaikan checkout.
3. Status tetap `PENDING` sampai webhook gateway lolos pemeriksaan signature, gateway, reference, dan nominal.
4. Webhook mengaktifkan atau memperpanjang subscription, menandai invoice `PAID`, memberikan kredit awal secara idempoten, dan menulis audit.
5. Aktivasi manual oleh Super Admin tetap tersedia untuk trial, kontrak, atau pembayaran offline. Jalur manual tidak membuat transaksi gateway palsu.

## Rollback aman

1. Set kedua flag ke `false`, build, dan restart. Ini menghentikan semua write baru tanpa memengaruhi menu lama.
2. Jangan drop tabel sebagai rollback aplikasi. Data sekolah tetap disimpan untuk read/recovery.
3. Jika migration terbukti merusak database, hentikan aplikasi dan restore backup sesuai prosedur DBA. Jangan menjalankan SQL rollback destruktif secara improvisasi.

## Environment

```env
SCHOOL_COMMERCIALIZATION_ENABLED="false"
NEXT_PUBLIC_SCHOOL_COMMERCIALIZATION_ENABLED="false"
```

Flag client adalah kontrol visibilitas, bukan kontrol keamanan. Seluruh API tetap memeriksa flag server, role, school tenant, subscription, status, dan entitlement.
