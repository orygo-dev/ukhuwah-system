# Android Security Hardening

Tanggal verifikasi: 31 Agustus 2026

## Ruang lingkup

Perubahan ini mengamankan aplikasi Android student dan teacher beserta endpoint
yang dipakai aplikasi. Kontrak API, navigasi utama, desain dashboard, PJJ,
Mading, Zona Kreasi, inbox, follow, notifikasi, dan AdMob tidak diubah.

## Perubahan

- Build release gagal jika upload keystore resmi tidak tersedia; debug signing
  tidak lagi menjadi fallback release.
- Backup, device-transfer data, dan cleartext HTTP dinonaktifkan melalui
  manifest dan Network Security Configuration.
- Cookie Auth.js dipindahkan dari file biasa ke Android Keystore/iOS Keychain.
  Cookie lama dimigrasikan dahulu dan baru dihapus setelah penyimpanan
  terenkripsi berhasil.
- URL dasar aplikasi wajib HTTPS. Banner dan popup hanya membuka URL HTTPS yang
  valid dan tidak menerima scheme seperti `javascript:` atau `intent:`.
- Sumber ebook eksternal dibuka di browser perangkat. WebView internal hanya
  menerima origin GenPro, memblokir perpindahan origin, dan menonaktifkan
  JavaScript.
- Ebook PDF diunduh langsung ke file sementara dengan batas 90 MB, validasi
  signature PDF, atomic rename, dan cleanup file parsial ketika gagal.
- Gambar push hanya diunduh dari origin GenPro, tanpa redirect, wajib MIME
  gambar, maksimal 5 MB, dan dibaca secara terbatas.
- Avatar dan thumbnail diverifikasi dari magic bytes. MIME respons media selalu
  ditentukan server dari ekstensi tervalidasi dan memakai `nosniff`.
- Endpoint upload melakukan penolakan awal ketika `Content-Length` melebihi
  batas. Batas file setelah parsing tetap dipertahankan sebagai lapisan kedua.
- Follow/unfollow dibatasi 40 perubahan per menit per akun untuk mencegah spam
  notifikasi tanpa mengubah pemakaian normal.
- Test cookie lama diperbarui dari nama file `middleware` lama ke `proxy` yang
  benar.

## Hasil verifikasi

- `flutter analyze`: PASS, 0 issue.
- Flutter regression suite: PASS, 115 test termasuk hardening tambahan.
- Secure-cookie dan widget security subset: PASS, 36 test.
- API security tests: PASS, 26 test.
- PJJ/LiveKit tests: PASS, 58 test.
- Social, upload URL, dan reading tests: PASS, 19 test.
- `npm run build`: PASS, termasuk TypeScript dan 115 static pages.
- `npm audit --omit=dev`: PASS, 0 vulnerability dependency produksi.
- APK student debug: PASS.
- APK teacher debug: PASS.
- Manifest APK: `allowBackup=false`, `usesCleartextTraffic=false`, aturan
  backup/data extraction terpasang, dan PJJ foreground service tetap
  `exported=false`.

## Risiko residual dan verifikasi eksternal

- Upgrade mayor LiveKit/WebRTC tidak digabungkan ke hardening ini karena dapat
  menimbulkan regresi PJJ. Upgrade harus dikerjakan dalam batch terpisah dengan
  pengujian perangkat nyata.
- Pembatasan Firebase API key, Firebase App Check, deklarasi Data Safety,
  target audience Play, dan konfigurasi AdMob harus diverifikasi di console
  masing-masing; hal tersebut tidak dapat dibuktikan hanya dari source.
- Batas request chunked tanpa `Content-Length` harus juga diterapkan pada Apache
  atau reverse proxy server. Validasi ukuran file di aplikasi tetap aktif.
- Sebelum rilis Play Store, build AAB release harus diverifikasi menggunakan
  upload certificate yang terdaftar dan diuji pada perangkat fisik untuk login,
  pergantian akun, push, PJJ, upload, ebook, background/foreground, serta
  reconnect jaringan.

## Status

Source hardening dan regression verification: **PASS**.

Production security sign-off penuh tetap memerlukan verifikasi console dan
perangkat fisik yang tercantum pada risiko residual.
