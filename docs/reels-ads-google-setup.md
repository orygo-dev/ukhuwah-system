# Google AdSense untuk Reels Ads GenPro

Tanggal verifikasi implementasi: 29 Agustus 2026.

## Batas implementasi

- Google AdSense hanya dimuat pada Spotlight guru di web (`/dashboard/spotlight`).
- Spotlight siswa dan aplikasi Android belum memakai unit ini karena keduanya memiliki alur terpisah.
- Iklan milik platform yang sudah ada tetap tersedia sebagai provider lain; datanya tidak dihapus ketika provider diganti.
- Google AdSense selalu dikirim dengan **age treatment remaja (`TFAT=2`)**. Personalisasi dan remarketing dinonaktifkan oleh Google untuk request tersebut.
- GenPro tidak mencatat klik atau impression Google. Pelaporan dan pendapatan berasal dari dashboard AdSense.
- Konfigurasi gagal-tertutup: script Google tidak dimuat sampai provider Google dipilih, format Publisher ID dan Slot ID valid, konfirmasi kebijakan aktif, serta Reels Ads disimpan dalam keadaan aktif.

## Persiapan wajib di Google

1. Daftarkan dan dapatkan persetujuan AdSense untuk domain produksi GenPro.
2. Buat unit **Display responsif**, lalu catat Publisher ID (`ca-pub-` + 16 digit) dan Ad Slot ID numeriknya.
3. Karena Spotlight berada di balik login, siapkan **Crawler access/login** pada AdSense dan verifikasi domain melalui Search Console. Rujukan: [Display ads on login-protected pages](https://support.google.com/adsense/answer/161351).
4. Konfigurasikan **Privacy & Messaging** atau CMP tersertifikasi Google untuk traffic EEA, UK, dan Swiss jika traffic tersebut dilayani. Rujukan: [Google consent management requirements](https://support.google.com/adsense/answer/13554116).
5. Publikasikan dan jalankan kebijakan moderasi konten. Publisher bertanggung jawab atas seluruh user-generated content yang berdampingan dengan iklan. Rujukan: [User-generated content overview](https://support.google.com/adsense/answer/1355699) dan [Good strategies for managing UGC](https://support.google.com/adsense/answer/3011869).
6. Pasang `ads.txt` yang diberikan AdSense pada domain produksi dan periksa Policy Center secara rutin.

Jangan mengaktifkan konfirmasi kebijakan apabila crawler login, moderasi, kebijakan privasi, persetujuan site, atau consent yang diwajibkan belum siap.

## Aktivasi di GenPro

1. Masuk sebagai Super Admin.
2. Buka **Reels Ads**.
3. Pilih **Google AdSense (web)** sebagai sumber iklan.
4. Isi Publisher ID dan Display Ad Slot ID.
5. Atur frekuensi sisipan, minimal satu iklan setelah tiga Spotlight organik.
6. Aktifkan konfirmasi kebijakan hanya setelah seluruh persiapan Google di atas selesai.
7. Aktifkan Reels Ads lalu tekan **Simpan**.

Jika ID atau konfirmasi tidak valid, API menolak aktivasi. Jika script Google diblokir jaringan/ad blocker, Spotlight tetap dapat digunakan dan slide menampilkan status iklan tidak tersedia.

## Verifikasi produksi

- Gunakan akun guru biasa; jangan mengklik iklan milik sendiri.
- Pastikan konten Spotlight tetap muncul berurutan dan slot Google hanya muncul sesuai frekuensi.
- Periksa browser console dan Network untuk `adsbygoogle.js` serta request yang membawa `tfat=2`.
- Periksa AdSense Crawler access, Policy Center, dan laporan unit setelah traffic valid tersedia.
- Jangan menilai pendapatan berdasarkan counter iklan platform; laporan Google berada di AdSense.

## Risiko tersisa

- Persetujuan domain, fill rate, harga iklan, dan pendapatan ditentukan Google, bukan GenPro.
- Implementasi tidak dapat membuktikan bahwa konfigurasi CMP/crawler di akun Google telah selesai; Super Admin harus mengonfirmasinya secara benar.
- Monetisasi Spotlight siswa/Android memerlukan desain terpisah, termasuk status umur, moderasi konten, consent SDK/webview, dan validasi kebijakan sebelum kode iklan dipasang.

## Hasil verifikasi implementasi

- 7 test khusus Reels Ads PASS: kompatibilitas konfigurasi lama, validasi ID, fail-closed, penyisipan feed, TFAT=2, isolasi kegagalan/resource cleanup, dan validasi API Super Admin.
- 162/162 regression tests lintas Reels Ads, Spotlight, landing, PJJ, keamanan/session, presence, komersialisasi sekolah, dan MCQ PASS.
- TypeScript dan build produksi Next.js PASS; tidak ada migration atau dependency baru.
- Targeted ESLint PASS. File Spotlight memiliki beberapa pelanggaran `react-hooks/set-state-in-effect` lama di area di luar perubahan ini; pemeriksaan perubahan baru dijalankan dengan rule lama tersebut dinonaktifkan khusus untuk file itu.
- Browser produksi lokal membuktikan `/admin/reels-ads` tetap terlindungi dan mengarahkan pengguna anonim ke login dengan callback yang benar; tidak ada error/warning console.
- Tampilan admin terautentikasi, request iklan Google nyata, crawler login, CMP, fill rate, dan laporan pendapatan **NOT TESTED** karena database lokal, akun Super Admin lokal, serta Publisher/Slot ID AdSense nyata tidak tersedia.
