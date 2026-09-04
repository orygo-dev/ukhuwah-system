# AdMob Native untuk Spotlight Android

Integrasi ini menayangkan Google AdMob Native sebagai slide tersendiri di sela feed Spotlight
aplikasi siswa dan guru. AdMob Android berdiri sendiri dari AdSense web, iklan internal platform,
dan rewarded ads.

## Perilaku aman

- Konfigurasi awal nonaktif dan tidak mengubah feed yang sudah berjalan.
- App debug selalu memakai App ID dan Native Ad Unit uji resmi Google.
- Build release ditolak bila App ID AdMob flavor terkait belum diberikan.
- Native Ad Unit produksi hanya dikirim ke sesi Android guru atau siswa yang valid.
- Semua permintaan iklan memakai `AgeRestrictedTreatment.teen` (TFAT=2) dan rating maksimum PG.
- UMP memperbarui status consent sebelum SDK diinisialisasi dan sebelum iklan diminta.
- Bila consent, endpoint, SDK, atau iklan gagal, sisipan AdMob dibuang dan feed organik tetap berjalan.
- Setiap objek `NativeAd` dilepas pada kegagalan dan saat slide di-dispose.

## Konfigurasi AdMob

1. Buat/daftarkan dua aplikasi Android di AdMob sesuai package yang dirilis:
   - siswa: `com.genpro.app`
   - guru: `com.genpro.teacher`
2. Buat Native Ad Unit Spotlight terpisah untuk aplikasi siswa dan guru agar laporan serta
   penegakan kebijakan mengikuti package aplikasi masing-masing.
3. Konfigurasikan Privacy & Messaging (UMP), app-ads.txt, kebijakan privasi, rating konten, dan
   deklarasi audiens di Play Console/AdMob.
4. Di Super Admin → Reels Ads → Google AdMob — Spotlight Android, isi Native Ad Unit siswa
   dan/atau guru, frekuensi, konfirmasi kesiapan kebijakan, lalu aktifkan dan simpan. Aplikasi
   yang kolom Ad Unit-nya kosong tetap menampilkan feed organik tanpa iklan.

## Build release

App ID adalah konfigurasi manifest dan tidak boleh dikirim dari server. Berikan melalui environment
variable atau Gradle property pada mesin build:

```powershell
$env:ADMOB_STUDENT_APP_ID = "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
flutter build appbundle --flavor student --release -t lib/main_student.dart

$env:ADMOB_TEACHER_APP_ID = "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"
flutter build appbundle --flavor teacher --release -t lib/main_teacher.dart
```

Untuk Linux/CI gunakan environment variable dengan nama yang sama. Jangan menyimpan ID bersama
credential atau secret lain; App ID dan Ad Unit ID bukan secret, tetapi perubahan konfigurasi tetap
harus melalui review rilis.

## Validasi sebelum produksi

1. Gunakan debug build dan pastikan label “Test Ad” terlihat; jangan mengklik iklan produksi saat QA.
2. Uji pengguna yang memerlukan consent dan yang tidak memerlukan consent.
3. Uji feed pendek, feed panjang, refresh, berpindah tab, background/foreground, offline, dan gagal
   memuat iklan. Konten organik harus tetap utuh dan berurutan.
4. Setelah AAB baru dirilis ke internal testing, aktifkan Ad Unit produksi dari Super Admin.
5. Pantau fill rate, policy center, ANR/crash, dan keluhan konten iklan. Nonaktifkan toggle AdMob
   bila ada masalah; hal ini tidak menonaktifkan AdSense web atau iklan internal.

Perubahan native/plugin berarti aplikasi Play Store yang sudah terbit harus dibangun dan dirilis
ulang. Update server saja tidak dapat menambahkan SDK AdMob ke APK/AAB lama.
