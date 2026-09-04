# GenPro Mobile

Satu codebase Flutter menghasilkan dua aplikasi yang dapat dikembangkan dan dirilis secara terpisah:

- **GenPro** untuk siswa (`com.genpro.app`).
- **GenPro Guru** untuk guru (`com.genpro.teacher`).

Keduanya menggunakan autentikasi dan database yang sama dengan aplikasi web, sehingga tidak menyimpan kata sandi maupun kunci LiveKit di perangkat. Setiap binary hanya menerima akun dengan role yang sesuai.

## Fitur awal

- Login berbasis role dan sesi cookie aman.
- Dashboard siswa: tugas, kuis, ujian, TKA, Zona Baca, PJJ, pemberitahuan, dan profil.
- Simulasi TKA: timer, navigasi soal, autosave jawaban, submit, dan hasil.
- Dashboard guru: ringkasan kelas, aktivitas, kelas PJJ, presensi, pesan, dan profil.
- Ruang PJJ LiveKit native dengan kamera, mikrofon, peserta, dan token sementara dari backend.

## Menjalankan

```powershell
flutter pub get

# GenPro siswa
flutter run --flavor student -t lib/main.dart --dart-define=GURUSPACE_BASE_URL=https://ukhuwahsystem.navalogi.id

# GenPro Guru
flutter run --flavor teacher -t lib/main_teacher.dart --dart-define=GURUSPACE_BASE_URL=https://ukhuwahsystem.navalogi.id
```

Untuk backend lokal pada Android Emulator gunakan `http://10.0.2.2:3000`. Pada perangkat fisik gunakan alamat IP LAN komputer pengembang dan pastikan backend dapat diakses melalui jaringan yang sama.

## Pemeriksaan kualitas

```powershell
flutter analyze
flutter test

flutter build apk --release --flavor student -t lib/main.dart --dart-define=GURUSPACE_BASE_URL=https://ukhuwahsystem.navalogi.id
flutter build apk --release --flavor teacher -t lib/main_teacher.dart --dart-define=GURUSPACE_BASE_URL=https://ukhuwahsystem.navalogi.id
```

Konfigurasi LiveKit tetap dilakukan oleh super admin pada aplikasi web. Aplikasi mobile hanya meminta token ruang untuk sesi PJJ yang memang dapat diakses pengguna.
