# GuruSpace Finalization Matrix

Dokumen ini menjadi kendali tunggal penyelesaian GuruSpace. Tujuannya bukan membuat roadmap baru, tetapi mengunci status: apa yang sudah ada, apa yang belum final, apa yang harus diperbaiki, dan kapan aplikasi dianggap siap digunakan.

Aturan kerja setelah dokumen ini ada:

1. Tidak membuat tahap baru di luar matriks tanpa persetujuan.
2. Setiap pekerjaan berikutnya harus mengambil item dari bagian `Gap Finalisasi`.
3. Setiap item selesai harus diuji, dicatat hasilnya, lalu di-commit.
4. Fitur yang sudah ada tidak boleh dibangun ulang kecuali terbukti rusak.
5. Fitur role siswa/admin sekolah yang belum final tidak boleh dianggap "belum ada" jika route/API-nya sudah tersedia.

## Ringkasan Status

| Area | Status Saat Ini | Keputusan |
| --- | --- | --- |
| Super Admin | Ada, banyak modul sudah tersedia | Finalisasi akses, aksi manage, dan UI konsistensi |
| Guru | Ada dan menjadi role utama | Finalisasi workflow guru dan shared class |
| Siswa | Ada portal dan fitur inti | Uji end-to-end dan perbaiki gap nyata |
| Admin Sekolah | Ada portal dasar | Uji end-to-end dan finalisasi manajemen sekolah |
| Orang Tua | Ada portal akses anak | Uji akses terbatas dan laporan anak |
| Mitra Wilayah | Ada portal dan dashboard | Uji login, dashboard, payout, dan komisi |
| Kredit dan SaaS | Ada | Pastikan sinkron kredit, paket, quota, payment |
| Generator AI | Ada dan berjalan | Jangan dirombak, hanya audit biaya/kredit/dokumen |
| Build/Deploy | Build sudah berhasil setelah dynamic route fix | Pertahankan jalur update server |

## Role Super Admin

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Dashboard admin | `src/app/admin/page.tsx` | Ada | Uji redirect login dan tampilan data |
| Manajemen pengguna | `src/app/admin/users/page.tsx`, `src/app/api/admin/users` | Ada | Pastikan aksi manage lengkap dan tidak hanya list |
| Paket langganan | `src/app/admin/plans/page.tsx`, `src/app/api/admin/plans` | Ada | Uji tambah, edit, quota fitur |
| Paket kredit | `src/app/admin/credit-packages/page.tsx`, `src/app/api/admin/credit-packages` | Ada | Uji tambah/edit paket kredit |
| Payment gateway | `src/app/admin/payment-settings/page.tsx`, `src/app/api/admin/payment-gateways` | Ada | Uji konfigurasi gateway aktif |
| AI settings | `src/app/admin/ai-settings/page.tsx` | Ada | Uji provider/model aktif |
| AI Usage & Cost | `src/app/admin/ai-usage/page.tsx` | Ada | Uji log biaya dan tampilan ringkas |
| Affiliate | `src/app/admin/affiliate/page.tsx`, `src/app/api/admin/affiliate` | Ada | Uji tier komisi dan aturan premium only |
| Mitra wilayah | `src/app/admin/partners/page.tsx`, `src/app/api/admin/affiliate/partners` | Ada | Uji tambah/edit mitra dan status |
| Wilayah & sekolah | `src/app/admin/school-directory/page.tsx` | Ada | Uji provinsi, kabupaten, sekolah, jenjang |
| Tampilan aplikasi | `src/app/admin/app-display/page.tsx` | Ada | Uji logo, banner desktop/mobile |
| WhatsApp gateway | `src/app/admin/whatsapp-gateways/page.tsx` | Ada | Uji setting gateway aktif |

## Role Guru

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Dashboard guru | `src/app/dashboard/page.tsx` | Ada | Uji data wallet, paket, banner, top rank affiliate |
| Profil guru | `src/app/dashboard/profil/page.tsx` | Ada | Uji wajib profil sebelum fitur utama |
| Kelas & siswa | `src/app/dashboard/kelas`, `src/app/api/attendance/classes` | Ada | Uji kelas pribadi dan kelas sekolah bersama |
| Import siswa | `src/components/classes/student-import-tools.tsx` | Ada | Uji template dan upload file |
| Absensi | `src/app/dashboard/absensi`, `src/app/api/attendance` | Ada | Uji create sesi, edit owner, rekap |
| Jurnal harian | `src/app/dashboard/jurnal`, `src/app/api/journals` | Ada | Uji jurnal per kelas dan export |
| Penilaian | `src/app/dashboard/penilaian`, `src/app/api/grading` | Ada | Uji input nilai, rekap, rapor |
| Tugas | `src/app/dashboard/tugas`, `src/app/api/assignments` | Ada | Uji buat tugas, siswa submit, guru nilai |
| Quiz | `src/app/dashboard/quiz`, `src/app/api/quizzes` | Ada | Uji buat quiz dan siswa mengerjakan |
| Exam | `src/app/dashboard/exam`, `src/app/api/exams` | Ada | Uji jadwal, durasi, siswa mengerjakan |
| Dokumen AI | `src/app/dashboard/tools`, `src/app/api/generate` | Ada | Uji kredit, refund gagal, simpan dokumen |
| AI Assistant | `src/app/dashboard/assistant/page.tsx` | Ada | Uji workflow assistant ke generator |
| Affiliate guru | `src/app/dashboard/afiliasi/page.tsx` | Ada | Uji referral, komisi premium, payout |
| Topup dan billing | `src/app/dashboard/topup`, `src/app/dashboard/billing` | Ada | Uji payment create/status dan sinkron kredit |

## Role Siswa

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Dashboard siswa | `src/app/student/page.tsx` | Ada | Uji data kelas dan ringkasan aktivitas |
| Login akun siswa | `src/app/api/students/[id]/account`, `src/app/api/students/accounts/bulk` | Ada | Uji pembuatan akun oleh guru/admin sekolah |
| Tugas siswa | `src/app/student/tugas`, `src/app/api/student/assignments/[id]/submission` | Ada | Uji submit tugas dan status terkumpul |
| Quiz siswa | `src/app/student/quiz`, `src/app/api/student/quizzes/[id]/attempt` | Ada | Uji attempt sekali dan skor |
| Exam siswa | `src/app/student/exam`, `src/app/api/student/exams/[id]/attempt` | Ada | Uji window jadwal, durasi, skor |
| Nilai siswa | `src/app/student/nilai/page.tsx` | Ada | Uji hanya nilai siswa terkait |
| Absensi siswa | `src/app/student/absensi/page.tsx` | Ada | Uji hanya absensi siswa terkait |
| Mading siswa | `src/app/student/mading`, `src/app/api/student/board-posts` | Ada | Uji buat, lihat, scope sekolah/publik |
| Spotlight siswa | `src/app/student/spotlight`, `src/app/api/student/spotlight-submissions` | Ada | Uji submit dan review guru |

## Role Admin Sekolah

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Dashboard sekolah | `src/app/school/page.tsx` | Ada | Uji ringkasan sekolah |
| Kelola kelas | `src/app/school/classes/page.tsx` | Ada | Uji create/edit kelas sekolah |
| Kelola siswa | `src/app/school/students/page.tsx` | Ada | Uji import siswa dan akun siswa |
| Kelola guru | `src/app/school/teachers/page.tsx` | Ada | Uji daftar guru sekolah dan monitoring |
| Monitoring aktivitas | `src/app/school/page.tsx`, `src/app/school/students/page.tsx` | Ada | Uji data absensi, nilai, tugas, quiz, exam |

## Role Orang Tua

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Login kode orang tua | `src/app/orangtua/page.tsx`, `src/app/api/parent/verify` | Ada | Uji kode valid/invalid |
| Portal orang tua | `src/app/orangtua/portal/page.tsx`, `src/app/api/parent/dashboard` | Ada | Uji hanya data anak terkait |
| Laporan PDF | `src/app/api/parent/report/pdf/route.ts` | Ada | Uji export laporan anak |

## Role Mitra Wilayah

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Landing mitra | `src/app/mitra-wilayah/page.tsx` | Ada | Uji CTA dan portal mitra |
| Login mitra | `src/app/partner/login/page.tsx`, `src/app/api/partner/login` | Ada | Uji login/logout |
| Dashboard mitra | `src/app/partner/page.tsx`, `src/app/api/partner/me` | Ada | Uji komisi, guru premium wilayah, payout |
| Pencairan mitra | `src/app/api/partner/payout/route.ts` | Ada | Uji request payout dan status |

## Sistem Kredit, Paket, dan AI

| Modul/Fungsi | Bukti Route/File | Status | Gap Finalisasi |
| --- | --- | --- | --- |
| Pemotongan kredit generator | `src/app/api/generate/route.ts` | Ada | Uji sukses, gagal, refund |
| Penyimpanan dokumen | `src/app/api/documents` | Ada | Uji dokumen tersimpan setelah generate |
| Header kredit | dashboard layout/session | Ada | Uji sinkron setelah generate |
| Paket langganan | `src/app/api/plans`, `src/app/api/payment` | Ada | Uji quota fitur dan renewal |
| AI usage tracking | `src/app/admin/ai-usage/page.tsx` | Ada | Uji log provider/model/cost/margin |

## Gap Finalisasi Utama

Ini daftar tertutup pekerjaan berikutnya. Jangan menambah daftar baru tanpa persetujuan.

1. Uji login dan redirect semua role. `SELESAI SEBAGIAN` - middleware sudah enforce redirect role ke dashboard yang benar.
2. Uji logout semua role, pastikan tidak mengarah ke localhost. `SELESAI` - logout NextAuth memakai `/` relatif, mitra ke `/partner/login`, orang tua ke `/orangtua`, dan portal orang tua kini diproteksi server-side.
3. Uji role guru dari kelas sampai aktivitas belajar lengkap. `SELESAI AUDIT KODE` - akses kelas, roster, absensi, jurnal, penilaian, tugas, quiz, dan exam sudah dicek; copy tugas dan label kelas absensi diperbaiki; hapus siswa di detail absensi kini menampilkan error API; audit DB lokal tidak bisa jalan karena MySQL `localhost:3306` tidak aktif.
4. Uji role siswa dari login sampai mengerjakan tugas, quiz, exam. `SELESAI AUDIT KODE` - portal siswa, dashboard, list/detail tugas, quiz, dan exam sudah scoped ke akun siswa aktif dan kelas aktif; kunci jawaban quiz/exam tidak dikirim sebelum attempt; exam dibatasi jadwal; submit tugas setelah status `GRADED` kini ditolak agar nilai/feedback guru tidak terhapus.
5. Uji admin sekolah membuat kelas, import siswa, membuat akun siswa. `SELESAI AUDIT KODE` - portal `/school` diproteksi role `SCHOOL_ADMIN`; kelas sekolah hanya bisa dibuat untuk guru di sekolah yang sama; roster/import siswa memakai akses kelas sekolah yang sama; akun siswa single/bulk dibuat dengan role `STUDENT` dan `schoolId` sekolah; halaman kelas admin sekolah kini reload roster setelah aktivasi akun siswa, reset password, dan kode orang tua agar UI tidak stale.
6. Uji orang tua dengan kode akses dan laporan anak. `SELESAI AUDIT KODE` - login orang tua memakai kode akses bcrypt dan cookie bertanda tangan; portal/PDF hanya membaca `studentId` dari token orang tua lalu membatasi data ke siswa dan kelas anak tersebut; verifikasi kode kini scan bertahap, tidak lagi gagal untuk kode lama setelah lebih dari 500 kode aktif; portal mengembalikan orang tua ke login jika sesi dicabut atau akses anak dinonaktifkan.
7. Uji mitra wilayah dari login sampai dashboard komisi. `SELESAI AUDIT KODE` - portal `/partner` diproteksi cookie session mitra aktif; login memakai kode mitra aktif dan password bcrypt; session mitra kini memakai secret auth terpusat; dashboard/API `/api/partner/me` hanya membaca komisi, statistik, profil, dan payout milik `partner.id`; request payout mengunci saldo, menolak payout ganda, mewajibkan rekening lengkap, dan data performa wilayah tidak lagi menampilkan angka/wilayah sintetis.
8. Uji SaaS: paket, topup kredit, payment status, quota. `SELESAI AUDIT KODE` - paket dan kredit hanya bisa dibeli akun guru; transaksi dibuat untuk satu produk aktif dengan gateway default aktif; webhook Midtrans/Tripay memvalidasi signature dan nominal sebelum aktivasi; aktivasi transaksi idempotent dari status `PENDING` ke `PAID`; kredit topup/langganan diberikan lewat ledger idempotent; quota paket diterapkan pada generate, export, kelas, siswa, AI Assistant, dan afiliasi. Halaman sukses pembayaran kini mencoba sinkronisasi status sandbox/demo melalui endpoint status yang sudah ada agar testing tidak tertahan `PENDING` ketika `PAYMENT_AUTO_ACTIVATE_SANDBOX=true`. Audit DB lokal belum bisa dijalankan karena MySQL `localhost:3306` tidak aktif.
9. Uji generator: kredit, refund gagal, dokumen tersimpan, header kredit sinkron. `SELESAI AUDIT KODE` - biaya generator dibaca dari katalog dinamis `aiToolConfig` sehingga tampilan dan API memakai nilai yang sama; payload wajib divalidasi sebelum AI dipanggil; kredit hanya dicek sebelum generate dan baru dipotong di transaksi DB setelah dokumen berhasil dibuat, sehingga kegagalan AI tidak memerlukan refund karena belum ada pemotongan; dokumen dan ledger kredit berada dalam transaksi yang sama agar tidak terjadi dokumen tanpa potongan kredit atau potongan kredit tanpa dokumen; AI usage gagal dicatat dengan `creditCharged` nol dan usage sukses ditempel ke dokumen setelah penyimpanan. Header kredit setelah generate kini memanggil refresh session NextAuth agar saldo di header ikut berubah, bukan hanya saldo lokal generator. Audit runtime DB lokal belum bisa dilanjutkan karena database `guru_space` belum sinkron dengan schema terbaru: kolom `students.user_id` belum ada.
10. Uji build dan deployment path. `SELESAI AUDIT KODE` - `npm run build` berhasil pada Next.js production; repo kini memiliki `ecosystem.config.cjs` untuk menjalankan `next start` via PM2 dengan `PORT=3000`, `NODE_ENV=production`, dan batas memori 1024 MB; panduan aaPanel/Apache/PM2 diperjelas untuk startup file, run dir, restart update, reverse proxy, dan perubahan port. Audit runtime DB lokal masih bergantung pada database yang sudah sinkron dengan `schema.prisma`.

## Definition of Done

Aplikasi dianggap siap digunakan semua role jika:

1. `npm run build` berhasil.
2. Login setiap role masuk ke dashboard yang benar.
3. Logout setiap role kembali ke URL production relatif, bukan localhost.
4. Guru bisa menjalankan workflow utama tanpa error.
5. Siswa bisa login dan menyelesaikan aktivitas belajar.
6. Admin sekolah bisa mengelola kelas, siswa, dan akun siswa.
7. Orang tua hanya bisa melihat data anak.
8. Mitra bisa melihat komisi dan mengajukan pencairan.
9. Kredit dan paket tidak bocor, tidak salah potong, dan refund gagal berjalan.
10. Tidak ada menu role yang menampilkan fitur belum matang tanpa alasan.
