# Siswa Online

Fitur tambahan; tidak mengubah alur login, password, lisensi sekolah, absensi,
penilaian, atau batas PJJ. Status ini bukan bukti siswa mengikuti pembelajaran.

## Menu dan batas akses

- Guru: `/dashboard/siswa-online`, siswa dari kelas milik guru atau penugasan
  mengajar yang masih aktif.
- Admin sekolah: `/school/siswa-online`, hanya siswa sekolahnya. Akun admin
  tanpa sekolah tidak mendapat akses data.
- Super admin: `/admin/siswa-online`, seluruh sekolah.
- Siswa, admin provinsi, dan pengguna tanpa login tidak dapat membaca daftar.

Pembatasan diterapkan lagi pada API `/api/student-presence`, termasuk pada
jumlah siswa, jumlah online, pencarian `q`, dan pagination 50 baris. Parameter
schoolId/userId/role dari klien tidak dapat memperluas akses. Respons hanya
memuat nama siswa, nama kelas/sekolah, status, dan waktu aktivitas terakhir;
tidak memuat email, password, telepon, IP, atau token login.

## Arti status

- **Online**: server menerima heartbeat terautentikasi dalam 120 detik terakhir.
- **Offline**: pernah mengirim heartbeat, tetapi sudah melewati batas tersebut.
- **Belum terpantau**: belum ada heartbeat, misalnya masih menggunakan APK lama.

Pengirim bekerja tiap 45 detik hanya saat web terlihat atau Android foreground.
Web mencakup portal siswa serta halaman ruang PJJ. Menu pemantauan terdapat
di dashboard web; perubahan Android pada fitur ini adalah pengirim status siswa.
APK Android siswa harus dibangun dan diperbarui agar ikut terpantau.

Logout/menutup tab/background/koneksi hilang tidak langsung mengubah status:
masa tenggang maksimal sekitar 2 menit, ditambah interval refresh pengamat.
Tidak ada permintaan offline saat menutup satu tab karena siswa mungkin masih
aktif di tab/perangkat lain. Layar idle yang tetap terbuka dapat tetap online.
Ini bukan daftar seluruh sesi login yang belum kedaluwarsa.

## Penyimpanan dan isolasi kegagalan

Migration aditif `202608280001_student_presence` membuat tabel
`student_presences` dengan satu primary key per siswa dan index `last_seen_at`.
Tidak ada perubahan kolom/tabel autentikasi. Tidak merekam riwayat kegiatan,
lokasi, isi layar, atau identitas perangkat. Catatan dihapus lewat FK cascade
ketika siswa dihapus; tanpa cleanup timer/proses background tambahan.

Heartbeat POST menggunakan studentId dari hasil `auth()`, bukan body/query.
Timestamp berasal dari server. Conditional update mempertahankan waktu yang
monotonik dan membatasi write per siswa sekitar sekali per 30 detik. Duplicate
insert dari dua perangkat ditangani tanpa menggandakan catatan.

Polling single-flight, timeout terbatas, berhenti saat tidak aktif/unmount,
membersihkan listener/timer, dan membatalkan request. Resume cepat saat request
sebelumnya sedang dibatalkan tidak menghasilkan request paralel. Error 401/403
menghentikan pengirim tanpa mengubah state login. Error layanan/migration pada
fitur ini memberikan 503 dan tidak menghalangi fitur belajar lainnya. Panel
tidak menampilkan status online lama sebagai valid saat refresh gagal.

## Deployment

Rilis ini berfokus pada web. Sender Flutter yang disiapkan sebelumnya belum
ikut commit/rilis web ini; langkah Android di bawah adalah rollout terpisah
setelah pengembangan mobile dilanjutkan. Update server tidak mengharuskan
pengguna APK lama langsung memperbarui aplikasi.

1. Backup database target dan simpan restore point. Periksa branch/commit dan
   daftar migration pending sebelum menerapkannya.
2. Terapkan migration dengan `npx prisma migrate deploy` pada database yang
   telah dikonfirmasi. Jangan gunakan reset, db push, atau seed.
3. Jalankan `npx prisma generate` dan build, lalu restart hanya `guruspace`
   setelah build berhasil. Port dan konfigurasi PM2 tidak perlu diubah.
4. Buka menu ketiga peran, pastikan cakupan sesuai akun. Buka portal siswa,
   tunggu heartbeat, dan verifikasi perubahan setelah aplikasi ditutup.
5. Build/install APK siswa baru, lalu uji foreground/background, login/logout,
   jaringan terputus/pulih dan dua perangkat. APK lama tetap dapat digunakan
   untuk fitur lama, tetapi tidak mengirim status online.

Migration belum diterapkan pada server dari workstation ini. Database lokal
`localhost:3306` tidak dapat diverifikasi saat implementasi. Tidak ada klaim
bahwa migration/load nyata atau Android fisik sudah lulus.

## Pengujian pengembang

`npm run test:presence` menguji handler aktual dengan fixture auth/database,
isolasi sekolah/guru, spoofing identitas, TTL, pagination, konkurensi,
degradasi layanan, timeout, dan cleanup polling. Test tidak memakai database
produksi dan bukan pengganti uji migrasi/concurrency pada MySQL nyata.

Untuk rollout Flutter berikutnya: jalankan `flutter test test/student_presence_reporter_test.dart` serta
regresi auth, varian aplikasi dan PJJ. Test widget memakai HTTP adapter fiktif.
Browser panel diuji dengan fixture lokal yang mengimpor komponen sebenarnya;
login lintas peran dan menu lengkap tetap memerlukan database yang sehat.

Sebelum rollout luas, ukur latensi/load database dari heartbeat dan pemantauan
(dua count dan satu query paginasi per refresh). Belum dilakukan load test
besar. Lakukan pilot terbatas dengan siswa/guru sebelum memperluas penggunaan.

Catatan tooling: konfigurasi lint lama proyek masih memakai `FlatCompat` yang
gagal memuat konfigurasi Next.js 16 (circular structure). Konfigurasi tersebut
tidak diubah dalam fitur ini. File baru diperiksa terpisah memakai flat config
Next.js terpasang melalui konfigurasi sementara di luar repository.
