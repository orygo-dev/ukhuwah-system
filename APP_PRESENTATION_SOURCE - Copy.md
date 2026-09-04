# APP_PRESENTATION_SOURCE

Dokumen ini adalah sumber materi presentasi aplikasi GuruSpace. Isi dokumen dibuat berdasarkan struktur route, API, dan `PROJECT_FINALIZATION_MATRIX.md` pada repo saat ini. Status fitur dibedakan agar materi presentasi tidak mengklaim hal yang belum final secara runtime.

## 1. Latar Belakang dan Masalah

Guru memiliki beban administrasi harian yang besar: menyusun perangkat ajar, mengelola kelas dan siswa, membuat absensi, jurnal mengajar, penilaian, tugas, quiz, ujian, serta menyimpan dokumen pembelajaran. Banyak pekerjaan masih dilakukan manual memakai file terpisah, spreadsheet, dokumen Word, dan aplikasi yang tidak saling terhubung.

Masalah yang diselesaikan GuruSpace:

- Pembuatan dokumen administrasi guru memakan waktu lama.
- Dokumen pembelajaran tersebar di banyak file dan sulit dilacak.
- Guru perlu mengelola kelas, siswa, absensi, tugas, nilai, dan ujian dalam alur yang terpisah.
- Penggunaan AI perlu dikendalikan dengan sistem kredit, paket, dan pengaturan biaya.
- Sekolah membutuhkan dasar struktur data bersama agar kelas dan siswa tidak selalu dibuat ulang oleh setiap guru.
- Orang tua membutuhkan akses terbatas untuk melihat laporan anak.
- Mitra wilayah membutuhkan dashboard komisi untuk membantu penyebaran aplikasi.

## 2. Tujuan Utama Aplikasi

GuruSpace bertujuan menjadi platform SaaS administrasi guru berbasis AI yang membantu guru membuat dokumen, mengelola aktivitas kelas, mengatur pembelajaran, dan menjalankan pekerjaan administratif dalam satu aplikasi.

Tujuan utama:

- Mempercepat pembuatan dokumen administrasi dan perangkat ajar.
- Menyatukan data guru, sekolah, kelas, siswa, aktivitas belajar, dan dokumen.
- Memberikan AI Assistant sebagai pemandu workflow, bukan pengganti generator.
- Mengatur penggunaan AI melalui kredit, paket langganan, quota fitur, dan audit biaya.
- Menyediakan dasar portal multi-role: guru, siswa, admin sekolah, orang tua, super admin, dan mitra wilayah.

## 3. Target Pengguna

- Guru mata pelajaran.
- Guru wali kelas.
- Admin sekolah.
- Siswa.
- Orang tua siswa.
- Super admin platform.
- Mitra wilayah atau pihak yang membantu adopsi aplikasi di wilayah tertentu.

## 4. Role dan Hak Akses Pengguna

| Role | Status | Hak akses utama |
| --- | --- | --- |
| Super Admin | Selesai audit kode | Mengelola dashboard admin, pengguna, paket langganan, paket kredit, payment gateway, AI provider, AI usage & cost, affiliate, mitra wilayah, wilayah & sekolah, tampilan aplikasi, reward kredit, dan WhatsApp gateway. |
| Guru | Selesai audit kode | Mengelola profil, kelas, siswa, absensi, jurnal, penilaian, tugas, quiz, exam, dokumen AI, AI Assistant, topup kredit, paket langganan, dompet, afiliasi, spotlight, pesan, dan member. |
| Siswa | Selesai audit kode, perlu sinkron DB/runtime | Login memakai akun siswa yang dibuat guru/admin sekolah, melihat dashboard, tugas, quiz, exam, nilai, absensi, mading, dan spotlight siswa. |
| Admin Sekolah | Selesai audit kode, perlu sinkron DB/runtime | Mengelola ringkasan sekolah, kelas sekolah, siswa, akun siswa, guru sekolah, dan monitoring aktivitas sekolah. |
| Orang Tua | Selesai audit kode | Login memakai kode akses anak, melihat portal anak, absensi, nilai, aktivitas, dan laporan PDF terbatas pada anak terkait. |
| Mitra Wilayah | Selesai audit kode | Login portal mitra, melihat dashboard komisi wilayah, guru premium wilayah, performa, dan mengajukan pencairan. |

Catatan status: beberapa role sudah tersedia dan selesai audit kode, tetapi pengujian runtime penuh membutuhkan database yang sinkron dengan `schema.prisma`. Audit lokal terakhir tertahan karena kolom `students.user_id` belum ada di database lokal.

## 5. Fitur yang Sudah Aktif

### Selesai Audit Kode

- Login dan redirect role melalui middleware.
- Logout role guru/super admin/mitra/orang tua dengan URL relatif, tidak mengarah ke localhost.
- Dashboard guru.
- Profil guru dan validasi profil sebelum generator.
- Kelas & siswa, termasuk konsep kelas pribadi guru dan kelas sekolah bersama.
- Import siswa melalui template/upload.
- Absensi dan rekap.
- Jurnal harian.
- Penilaian, rekap, dan rapor semester.
- Tugas/PR.
- Quiz harian.
- Exam/ujian online.
- Generator dokumen AI.
- Penyimpanan dokumen dan export PDF/DOCX sesuai paket.
- AI Assistant sebagai workflow assistant menuju generator.
- Affiliate guru, komisi premium only, dan payout.
- Topup kredit.
- Paket langganan dan quota fitur.
- Dompet affiliate.
- Reward kredit.
- Spotlight, spotlight siswa, mading siswa, member, dan pesan.
- Super admin untuk paket, kredit, AI, payment, WhatsApp, affiliate, mitra wilayah, wilayah & sekolah, tampilan aplikasi, pengguna, dan AI usage.
- Portal siswa.
- Portal admin sekolah.
- Portal orang tua.
- Portal mitra wilayah.
- Deployment path aaPanel + Apache + PM2.

### Sebagian Selesai / Bergantung Konfigurasi

- Payment gateway: Midtrans dan Tripay sudah memiliki flow checkout/webhook; gateway lain seperti Flip Business dan iPaymu dapat dikonfigurasi di admin, tetapi checkout otomatis aktif saat ini diarahkan ke gateway yang sudah siap.
- AI provider: OpenAI, Gemini, OpenRouter, Claude/Anthropic, custom/OpenAI-compatible tersedia di layer provider, tetapi hasil AI real bergantung API key aktif dan kuota provider.
- Audit runtime semua role: kode sudah dibuild dan diaudit, tetapi pengujian DB lokal membutuhkan sinkronisasi database terbaru.
- WhatsApp gateway: pengaturan gateway tersedia; pengiriman OTP/notifikasi bergantung konfigurasi provider WhatsApp yang valid.

### Masih Direncanakan / Belum Layak Diklaim Final

- Pengembangan lanjutan role siswa dan admin sekolah yang lebih lengkap secara operasional sekolah besar.
- Penyempurnaan QA runtime end-to-end setelah database produksi/lokal sinkron.
- Penguatan migrasi database formal jika project akan memakai migration history, karena repo saat ini menggunakan `prisma db push` dan tidak memiliki folder `prisma/migrations`.

## 6. Alur Kerja Fitur Utama

### Registrasi dan Login Guru

1. Guru membuka halaman registrasi.
2. Guru mengisi data akun dan profil dasar.
3. Guru login melalui halaman login.
4. Middleware mengarahkan role guru ke dashboard guru.
5. Jika profil belum lengkap, guru diarahkan melengkapi profil sebelum memakai generator.

### Profil Guru

1. Guru membuka menu Profil Guru.
2. Guru melengkapi identitas, sekolah, jenjang, mapel, tahun ajaran, semester, dan kurikulum.
3. Data profil menjadi default untuk form generator.
4. Jika guru mengajar di lebih dari satu sekolah, struktur teaching profile mendukung profil mengajar tambahan.

### Generator Dokumen AI

1. Guru memilih generator dari kelompok menu AI Generator.
2. Guru mengisi form sesuai dokumen yang dipilih.
3. Aplikasi menampilkan biaya kredit modul.
4. API memvalidasi role, profil, status generator, quota paket, dan saldo kredit.
5. AI provider dipanggil sesuai pengaturan.
6. Jika AI berhasil, dokumen disimpan sebagai draft.
7. Kredit dipotong dalam transaksi database yang sama dengan penyimpanan dokumen.
8. AI usage log ditempel ke dokumen.
9. Saldo kredit di generator dan header diperbarui.

### AI Assistant

1. Guru membuka AI Assistant.
2. Guru memilih kebutuhan kerja melalui tombol yang sudah tersedia.
3. Assistant menganalisis workflow dan status dokumen pendukung.
4. Assistant menampilkan rekomendasi generator yang perlu dijalankan.
5. Guru memilih rekomendasi.
6. Aplikasi menampilkan estimasi biaya kredit.
7. Guru melanjutkan ke generator terkait.

Catatan: AI Assistant diposisikan sebagai workflow orchestrator. Assistant tidak menggantikan logika generator.

### Kelas dan Siswa

1. Guru atau admin sekolah membuat kelas.
2. Data kelas terkait dengan guru dan dapat memakai konteks sekolah.
3. Siswa dapat ditambahkan manual atau melalui upload template.
4. Akun siswa dapat dibuat dari data siswa.
5. Data kelas/siswa menjadi dasar absensi, tugas, quiz, exam, penilaian, dan portal siswa.

### Absensi

1. Guru memilih kelas.
2. Guru membuat sesi absensi.
3. Guru mengisi status kehadiran siswa.
4. Data absensi dapat direkap.
5. Siswa/orang tua dapat melihat informasi absensi sesuai hak akses.

### Jurnal Harian

1. Guru memilih kelas dan periode.
2. Guru mencatat aktivitas mengajar.
3. Jurnal tersimpan sebagai dokumentasi harian.
4. Jurnal dapat dibuka kembali dan diexport sesuai fitur yang tersedia.

### Penilaian dan Rapor

1. Guru membuat assessment atau komponen nilai.
2. Guru menginput nilai siswa.
3. Aplikasi menampilkan rekap nilai.
4. Guru dapat memakai fitur rapor semester.
5. Data nilai siswa dapat ditampilkan terbatas di portal siswa/orang tua.

### Tugas, Quiz, dan Exam

1. Guru membuat tugas, quiz, atau exam.
2. Guru menentukan kelas, instruksi, jadwal, atau durasi sesuai tipe aktivitas.
3. Siswa membuka portal siswa.
4. Siswa mengerjakan atau mengumpulkan jawaban.
5. Guru menilai atau melihat hasil.
6. Siswa melihat status dan hasil sesuai aturan akses.

### Mading dan Spotlight Siswa

1. Siswa membuat konten mading atau mengirim karya spotlight.
2. Konten masuk ke alur review sesuai fitur.
3. Guru dapat meninjau konten siswa.
4. Konten yang disetujui dapat tampil sesuai scope yang tersedia.

### Topup Kredit

1. Guru membuka menu Top Up Kredit.
2. Guru memilih paket kredit aktif.
3. Aplikasi membuat transaksi pembayaran.
4. Payment gateway memproses pembayaran.
5. Webhook/status pembayaran mengubah transaksi menjadi paid.
6. Kredit ditambahkan melalui credit ledger.

### Paket Langganan

1. Guru membuka menu Paket Langganan.
2. Guru memilih paket premium aktif.
3. Payment gateway memproses pembayaran.
4. Setelah paid, paket diaktifkan selama periode langganan.
5. Kredit bulanan dan bonus kredit diberikan sesuai pengaturan paket.
6. Quota paket dipakai untuk membatasi fitur seperti generate, kelas, siswa, export, AI Assistant, dan afiliasi.

### Affiliate Guru

1. Guru membagikan kode/link referral.
2. Pengguna baru mendaftar melalui referral.
3. Komisi dihitung dari pembelian paket premium, bukan topup kredit dan bukan pemakaian kredit.
4. Komisi masuk ke dompet affiliate.
5. Guru dapat mengajukan payout sesuai aturan saldo dan rekening.

### Mitra Wilayah

1. Super admin membuat data mitra wilayah.
2. Mitra login melalui portal mitra.
3. Mitra melihat dashboard wilayah, guru premium, komisi, dan histori payout.
4. Mitra mengajukan pencairan jika saldo tersedia dan data rekening lengkap.

### Super Admin

1. Super admin login ke dashboard admin.
2. Super admin mengelola konfigurasi platform: pengguna, paket, kredit, payment, AI, WhatsApp, wilayah/sekolah, tampilan aplikasi, reward, affiliate, dan mitra.
3. Perubahan konfigurasi dipakai oleh role guru dan sistem transaksi.

## 7. Manfaat Setiap Fitur

| Fitur | Manfaat |
| --- | --- |
| Generator dokumen AI | Mengurangi waktu penyusunan dokumen administrasi dan perangkat ajar. |
| AI Assistant | Membantu guru memilih dokumen yang perlu dibuat berdasarkan workflow, bukan menebak menu. |
| Profil guru | Mengurangi input berulang di form generator. |
| Kelas & siswa | Menyatukan data dasar untuk absensi, tugas, quiz, exam, dan nilai. |
| Import siswa | Mempercepat input data siswa dari file. |
| Absensi | Membuat pencatatan kehadiran lebih rapi dan mudah direkap. |
| Jurnal harian | Menyimpan bukti kegiatan mengajar secara terstruktur. |
| Penilaian | Membantu pengelolaan nilai dan rekap belajar. |
| Tugas/PR | Mengatur pemberian tugas dan pengumpulan siswa. |
| Quiz harian | Memfasilitasi evaluasi cepat. |
| Exam/ujian online | Menyediakan alur ujian digital dalam aplikasi. |
| Dokumen saya | Menyimpan hasil dokumen agar mudah ditemukan kembali. |
| Export PDF/DOCX | Memudahkan dokumen dipakai untuk arsip atau cetak. |
| Topup kredit | Memberi fleksibilitas pembelian kredit di luar paket bulanan. |
| Paket langganan | Mengatur benefit dan quota penggunaan secara SaaS. |
| Reward kredit | Memberi opsi perolehan kredit tambahan sesuai aturan platform. |
| Affiliate guru | Memberi insentif referral untuk guru. |
| Dompet | Memisahkan saldo komisi rupiah dari saldo kredit. |
| Portal siswa | Memberi siswa akses aktivitas belajar digital. |
| Portal orang tua | Memberi orang tua akses terbatas terhadap informasi anak. |
| Portal admin sekolah | Menjadi dasar pengelolaan kelas, siswa, dan guru pada level sekolah. |
| Portal mitra wilayah | Membantu pemantauan komisi dan adopsi wilayah. |
| Super admin | Mengendalikan operasional, monetisasi, AI, payment, dan tampilan platform. |

## 8. Proses Manual yang Digantikan

- Menulis perangkat ajar dari dokumen kosong.
- Menyalin data profil guru berulang-ulang ke banyak dokumen.
- Menyimpan dokumen di folder lokal tanpa arsip terpusat.
- Menghitung saldo kredit atau penggunaan AI secara manual.
- Mencatat kelas dan siswa di spreadsheet terpisah.
- Import data siswa satu per satu.
- Mencatat absensi di buku atau spreadsheet.
- Membuat jurnal mengajar manual.
- Menginput dan merekap nilai tanpa sistem terpadu.
- Membagikan tugas/quiz/ujian tanpa portal siswa.
- Memberikan laporan anak ke orang tua secara manual.
- Menghitung komisi affiliate/mitra tanpa dashboard.
- Mengatur paket, quota, payment, dan provider AI langsung dari kode.

## 9. Penerapan Teknologi AI

GuruSpace memakai AI pada area berikut:

- Generator dokumen administrasi guru.
- AI Assistant untuk membantu guru memilih workflow dan rekomendasi dokumen.
- Multi-provider AI melalui pengaturan super admin.
- AI usage & cost tracking untuk mencatat provider, model, token, biaya, kredit, pendapatan, margin, latency, dan status request.
- Demo mode untuk menghasilkan template simulasi tanpa API key, berguna untuk pengujian UI/preview.

Arsitektur AI yang sudah diterapkan:

- Generator tetap menjadi modul utama pembuat dokumen.
- AI Assistant tidak membuat generator kedua; assistant mengarahkan guru ke generator yang sudah ada.
- Pemanggilan provider melewati service AI terpusat.
- Usage tracking menjadi wrapper/service pencatatan agar tidak mengulang logika di setiap generator.

## 10. Keunggulan Aplikasi

- Fokus pada kebutuhan administrasi guru Indonesia.
- Menggabungkan generator dokumen, kelas, siswa, absensi, nilai, tugas, quiz, exam, dan arsip dokumen.
- Mendukung sistem SaaS dengan paket, kredit, quota, payment gateway, dan dompet.
- Mendukung multi-role: guru, siswa, admin sekolah, orang tua, super admin, dan mitra wilayah.
- AI provider dapat dikonfigurasi dari super admin.
- Biaya AI dan margin dapat dilacak.
- Komisi affiliate dan mitra dipisahkan dari kredit pengguna.
- Deployment self-hosted didukung melalui aaPanel, Apache, dan PM2.

## 11. Dampak terhadap Waktu, Biaya, dan Kualitas

### Waktu

- Guru tidak perlu menyusun banyak dokumen dari awal.
- Data profil, kelas, dan siswa dapat digunakan ulang.
- Import siswa mempercepat input roster kelas.
- Arsip dokumen mengurangi waktu mencari file lama.

### Biaya

- Sistem kredit membantu membatasi penggunaan AI.
- Paket langganan dan quota memberi kontrol biaya operasional.
- AI usage & cost tracking membantu super admin memantau biaya provider dan margin.
- Affiliate dan mitra hanya dikomisikan dari paket premium, sehingga biaya insentif lebih terkendali.

### Kualitas

- Form generator memaksa data penting terisi sebelum dokumen dibuat.
- Dokumen tersimpan terpusat dan dapat diexport.
- Workflow assistant membantu guru baru memahami dokumen apa yang perlu dibuat.
- Pembatasan role membantu menjaga akses data sesuai pengguna.

## 12. Fitur yang Masih dalam Pengembangan

| Fitur/Area | Status | Catatan |
| --- | --- | --- |
| Runtime penuh role siswa | Sebagian selesai | Route dan API tersedia, tetapi perlu pengujian end-to-end pada DB yang sudah sinkron. |
| Runtime penuh admin sekolah | Sebagian selesai | Portal dasar dan API tersedia, tetapi perlu uji sekolah nyata dengan data guru, kelas, dan siswa. |
| Runtime penuh orang tua | Sebagian selesai | Portal dan kode akses tersedia, perlu uji data produksi. |
| Runtime penuh mitra wilayah | Sebagian selesai | Portal dan payout tersedia, perlu uji data produksi dan alur operasional payout. |
| Payment gateway selain Midtrans/Tripay | Sebagian/direncanakan | Konfigurasi admin dapat tersedia, tetapi checkout otomatis aktif perlu implementasi per provider. |
| Migration history Prisma | Direncanakan | Repo saat ini memakai `prisma db push`; belum ada folder `prisma/migrations`. |
| QA visual menyeluruh semua halaman | Direncanakan | Banyak halaman sudah ada, tetapi audit visual komersil per halaman masih perlu siklus khusus. |
| Pengembangan siswa/admin sekolah lanjutan | Direncanakan | Setelah finalisasi dasar, dapat dikembangkan ke workflow sekolah yang lebih matang. |

## 13. Halaman yang Cocok untuk Screenshot Presentasi

### Untuk Guru Calon Pengguna

- `/` - landing page utama.
- `/login` - halaman login.
- `/register` - halaman registrasi.
- `/dashboard` - dashboard guru.
- `/dashboard/assistant` - AI Assistant.
- `/dashboard/tools` - daftar generator dokumen.
- `/dashboard/tools/modul-ajar` - contoh form generator Modul Ajar/RPP.
- `/dashboard/documents` - dokumen saya.
- `/dashboard/kelas` - kelas & siswa.
- `/dashboard/absensi` - absensi.
- `/dashboard/penilaian` - penilaian.
- `/dashboard/tugas` - tugas/PR.
- `/dashboard/quiz` - quiz harian.
- `/dashboard/exam` - ujian online.
- `/dashboard/billing` - paket langganan.
- `/dashboard/topup` - topup kredit.
- `/dashboard/afiliasi` - affiliate guru.
- `/dashboard/wallet` - dompet.

### Untuk Super Admin

- `/admin` - dashboard super admin.
- `/admin/users` - manajemen pengguna.
- `/admin/plans` - paket langganan dan quota.
- `/admin/credit-packages` - paket topup kredit.
- `/admin/payment-settings` - payment gateway.
- `/admin/ai-settings` - pengaturan AI.
- `/admin/ai-usage` - AI Usage & Cost.
- `/admin/provider-clients` - provider API.
- `/admin/affiliate` - pengaturan affiliate.
- `/admin/partners` - mitra wilayah.
- `/admin/school-directory` - wilayah & sekolah.
- `/admin/app-display` - tampilan & promo.
- `/admin/whatsapp-gateways` - WhatsApp gateway.
- `/admin/reward` - reward dan kredit gratis.

### Untuk Siswa, Orang Tua, Admin Sekolah, dan Mitra

- `/student` - dashboard siswa.
- `/student/tugas` - tugas siswa.
- `/student/quiz` - quiz siswa.
- `/student/exam` - exam siswa.
- `/student/mading` - mading siswa.
- `/student/spotlight` - spotlight siswa.
- `/school` - dashboard admin sekolah.
- `/school/classes` - kelola kelas sekolah.
- `/school/students` - kelola siswa sekolah.
- `/school/teachers` - kelola guru sekolah.
- `/orangtua` - login kode orang tua.
- `/orangtua/portal` - portal orang tua.
- `/mitra-wilayah` - landing page mitra wilayah.
- `/partner/login` - login mitra.
- `/partner` - dashboard mitra wilayah.

## Catatan Kejujuran Presentasi

Gunakan istilah "sudah tersedia" atau "selesai audit kode" untuk fitur yang route/API/UI-nya ada dan build berhasil. Gunakan istilah "perlu uji runtime pada database sinkron" untuk role siswa, admin sekolah, orang tua, dan mitra jika belum diuji langsung di server produksi. Jangan menyebut fitur sebagai "final produksi penuh" sebelum database server sudah menjalankan `npx prisma db push`, aplikasi berhasil `npm run build`, PM2 restart, dan alur role diuji langsung.
