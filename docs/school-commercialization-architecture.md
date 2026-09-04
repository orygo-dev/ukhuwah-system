# Arsitektur Komersialisasi Sekolah

## Tujuan dan batas perubahan

Paket sekolah ditambahkan sebagai bounded context baru. Paket pribadi guru (`SubscriptionPlan`, `User.planId`, `Transaction`, dan `CreditLedger`) tidak diubah. Semua kemampuan baru fail-closed melalui `SCHOOL_COMMERCIALIZATION_ENABLED=false` dan menu sekolah melalui `NEXT_PUBLIC_SCHOOL_COMMERCIALIZATION_ENABLED=false`.

## Model akses

- Lisensi dimiliki `School` melalui `SchoolSubscription`, bukan akun admin sekolah.
- Guru memperoleh akses melalui `SchoolSeat` aktif. Seat dapat dilepas tanpa menghapus akun, dokumen pribadi, atau data sekolah.
- Hak efektif generator adalah gabungan hak pribadi dan seat sekolah. Saldo tetap terpisah; permintaan yang memakai benefit sekolah dibebankan ke `SchoolCreditLedger`, sedangkan alur lama tetap memakai `CreditLedger`.
- Status `TRIAL`, `ACTIVE`, dan `GRACE` dapat menulis hanya selama deadline masing-masing masih berlaku. `READ_ONLY`, `SUSPENDED`, `EXPIRED`, dan `CANCELED` tidak dapat menulis. Data lama tidak dihapus.

## Modul

1. Paket, subscription, seat, audit, invoice, dan ledger kredit sekolah.
2. Checkout mandiri Admin Sekolah memakai `SchoolPaymentTransaction`; transaksi ini terpisah dari `Transaction` milik guru. Paket hanya aktif setelah signature, gateway, dan nominal webhook tervalidasi.
3. Administrasi: surat, SK, program kerja, notulen, laporan, supervisi, dan dokumen lain.
4. Workflow dokumen: `DRAFT → IN_REVIEW → VERIFIED → APPROVED → ARCHIVED`. Output AI selalu `DRAFT`.
5. Versioning optimistik mencegah tab/perangkat lama menimpa perubahan baru.
6. Jadwal memakai constraint engine deterministik. Benturan guru, kelas, dan ruang ditolak; AI tidak menjadi penentu validitas.
7. Kalender sekolah dan laporan berbasis hitungan aktual dari database sekolah.
8. PJJ add-on memakai hard cap komersial 25 dan ledger pemakaian webhook per sesi. PJJ lama tidak digating ketika feature flag OFF.

## Keamanan dan isolasi tenant

Semua route sekolah mendapatkan `schoolId` dari session server, tidak dari body. Referensi guru dan kelas diverifikasi milik sekolah yang sama. Super Admin mempunyai endpoint terpisah. Nomor dokumen unik per sekolah, invoice unik global, dan idempotency key kredit unik.

## Race condition dan cleanup

- Kredit menggunakan compare-and-swap pada `creditBalance`, maksimum lima retry, larangan saldo negatif, dan idempotency key.
- Seat assignment dan penyimpanan jadwal menggunakan transaksi serializable.
- Dokumen dan jadwal memakai `expectedVersion`.
- Webhook LiveKit sudah idempoten berdasarkan event ID; metering berada dalam transaksi webhook yang sama.
- Tidak ada polling permanen atau timer baru di UI. Script rekonsiliasi selalu memanggil `prisma.$disconnect()` dalam `finally`.
- Satu sekolah hanya dapat memiliki satu checkout pending melalui unique nullable `activeCheckoutKey`. Idempotency key melindungi retry request yang sama; callback pembayaran memakai CAS `PENDING → PAID`.
- Upgrade/perpanjangan mempertahankan subscription dan seat. Downgrade melepaskan seat terbaru yang melampaui batas secara deterministik dan mencatat audit. Refund terakhir membuat subscription read-only; refund pembayaran lama tidak membatalkan renewal yang lebih baru.
