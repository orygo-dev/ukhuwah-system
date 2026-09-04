# GenPro Android — AdMob Publish Readiness

Tanggal verifikasi source: 1 September 2026

## Ruang lingkup

- Aplikasi siswa: `com.genpro.app`
- Aplikasi guru: `com.genpro.teacher`
- Penempatan iklan: Native Ad di feed Zona Kreasi
- Penempatan tambahan siswa: Native Ad di preview Mading serta Banner adaptive di daftar Zona Baca, Mading, Tugas, dan Quiz
- Situs penerbit: `https://guruspaceai.cloud`
- Privacy Policy siswa: `https://guruspaceai.cloud/privacy/siswa`
- Privacy Policy guru: `https://guruspaceai.cloud/privacy/guru`
- App ads declaration: `https://guruspaceai.cloud/app-ads.txt`

## Status source

| Pemeriksaan | Status | Bukti |
|---|---|---|
| App ID release wajib dan tervalidasi saat build | PASS | Gradle menolak release tanpa App ID berformat `ca-app-pub-…~…` |
| Debug memakai test unit Google | PASS | `kDebugMode` memilih unit Native/Banner test resmi sesuai format iklan |
| Ad Unit berasal dari konfigurasi server | PASS | Endpoint hanya mengembalikan unit valid sesuai role dan penempatan |
| Konfigurasi salah gagal secara tertutup | PASS | Iklan tidak disisipkan bila enabled, treatment, policy, atau unit tidak valid |
| Perlakuan umur | PASS dengan batasan | Siswa dan guru memakai `TEEN`, rating maksimum `PG`, tanpa personalisasi/remarketing |
| UMP sebelum permintaan iklan | PASS | Consent diperbarui, form ditampilkan bila perlu, lalu `canRequestAds()` diperiksa |
| Pilihan privasi ulang | PASS | Menu Profil → Privasi iklan tersedia |
| Resource cleanup | PASS | Timeout load, pembatalan timer, serta `NativeAd.dispose()`/`BannerAd.dispose()` tersedia |
| Privacy Policy siswa | PASS | Disclosure Google Mobile Ads SDK, UMP, data iklan, umur, dan hak pengguna |
| Privacy Policy guru | PASS | Halaman publik terpisah untuk package guru |
| `app-ads.txt` dalam source | PASS | `public/app-ads.txt`, satu seller Google DIRECT |
| AAB siswa `1.0.3 (6)` | PASS | `com.genpro.app`, 97.909.937 byte, SHA-256 tercatat di bawah |
| Android 16 KB page size | PASS | Seluruh ELF ARM64/x86_64 memiliki `PT_LOAD` alignment minimal `0x4000`; tidak ada kegagalan 64-bit |
| AAB guru | BLOCKED | `ADMOB_TEACHER_APP_ID` belum tersedia; build berhenti aman sebelum Gradle dijalankan |
| Play Console dan AdMob Console | VERIFIKASI PEMILIK AKUN | Harus disimpan/dikirim dari akun Google pemilik aplikasi |

## Hasil build release

### Siswa

- Artefak: `mobile/guruspace_mobile/build/app/outputs/bundle/studentRelease/app-student-release.aab`
- Package: `com.genpro.app`
- Version name/code: `1.0.3 (6)`
- Ukuran: `97.909.937` byte
- SHA-256: `A41F8E85257BCBA7C92BD573CEF032FC0BE3C635035B72EF249F001F71CC4DD4`
- Manifest hasil merge memuat App ID AdMob release siswa dan permission Advertising ID/Privacy Sandbox dari Google Mobile Ads SDK.
- Bundle ditandatangani dengan upload key lokal. `jarsigner` memverifikasi integritas signature; peringatan self-signed/tanpa timestamp adalah karakteristik upload key Android dan Play App Signing akan menandatangani APK distribusi.
- APK regression: `app-student-release.apk`, `139.064.129` byte, SHA-256 `ED130656D1478BB9519BEC429C57961EDA11FC8D528A7E4F106C0174B80EE1FB`.
- APK signature v2 terverifikasi. Instalasi runtime code `6` berstatus **NOT TESTED** karena emulator tidak lagi terhubung; build debug bersih PASS dan seluruh test setelah upgrade LiveKit PASS. Pengujian iklan produksi aktual tetap memerlukan endpoint web versi ini sudah dideploy dan Ad Unit penempatan sudah diisi.
- LiveKit diperbarui secara minimum ke `2.5.0+hotfix.1`, versi yang mengganti library noise Android dengan build pendukung 16 KB. Audit ELF AAB membuktikan seluruh library 64-bit kompatibel.
- Seluruh `126` test Flutter PASS; `dart analyze` PASS tanpa issue. Test web AdMob/privacy `18/18` PASS, TypeScript PASS, dan production web build PASS.

Untuk rilis berikutnya, buat Ad Unit terpisah di AdMob agar laporan setiap penempatan dapat dibedakan:

- `GenPro Siswa — Native Zona Kreasi`
- `GenPro Siswa — Native Mading Preview`
- `GenPro Siswa — Banner Zona Baca`
- `GenPro Siswa — Banner Mading`
- `GenPro Siswa — Banner Tugas`
- `GenPro Siswa — Banner Quiz`

Masukkan ID tersebut melalui Super Admin → Reels Ads. Unit yang kosong/tidak valid tidak pernah diminta oleh aplikasi. Saat debug aplikasi selalu memakai test unit Google; iklan Native Mading muncul paling cepat setelah empat konten organik, sedangkan banner tidak ditampilkan pada halaman mengerjakan tugas/quiz, PJJ, chat, login, formulir, atau empty state.

### Guru

Build release guru sengaja dihentikan oleh guard karena `ADMOB_TEACHER_APP_ID` belum dikonfigurasi. Jangan memakai App ID siswa atau App ID test untuk package `com.genpro.teacher`. Buat/ambil App ID Android tersendiri dari aplikasi guru di AdMob, lalu simpan melalui konfigurasi lokal yang tidak masuk Git sebelum membangun AAB guru.

## Batas audiens

Konfigurasi ini ditujukan bagi remaja berusia minimal 13 tahun sampai guru. Jangan memilih kelompok usia di bawah 13 tahun pada Play Console untuk build ini. Jika sekolah akan memberi akses kepada anak di bawah 13 tahun atau pengguna dengan usia tidak diketahui, hentikan penayangan AdMob untuk kelompok tersebut sampai tersedia neutral age screen dan perlakuan `CHILD` yang memenuhi Families Policy.

Penetapan umur ini adalah batas produk dan kebijakan, bukan hasil pengumpulan tanggal lahir. GenPro tidak menambahkan tanggal lahir agar alur akun lama tidak berubah.

## Data Safety — panduan pengisian

Jawaban akhir harus dibandingkan dengan seluruh fitur dan semua SDK pada artefak AAB. Untuk integrasi Google Mobile Ads SDK, minimal tinjau deklarasi berikut:

| Tipe data | Dikumpulkan/dibagikan oleh SDK | Tujuan yang relevan |
|---|---|---|
| Perkiraan lokasi dari alamat IP | Ya, sesuai dokumentasi SDK | Iklan, analitik, keamanan/fraud prevention |
| Interaksi produk dan interaksi iklan | Ya | Iklan dan analitik |
| Informasi diagnostik | Ya | Analitik, keamanan, stabilitas |
| Device or other identifiers termasuk Advertising ID bila tersedia | Ya | Iklan, pengukuran, fraud prevention |

Form Data Safety juga harus mencakup data fitur GenPro sendiri: akun, identitas sekolah/kelas, foto, konten pengguna, pesan, audio/video PJJ, aktivitas belajar, notifikasi, dan diagnostik. Jangan menyalin tabel SDK sebagai keseluruhan jawaban aplikasi.

## Play Console — tindakan pemilik akun

Untuk kedua package, periksa dan simpan:

1. **App content → Ads**: pilih **Yes, my app contains ads**.
2. **Privacy policy**:
   - siswa: `https://guruspaceai.cloud/privacy/siswa`
   - guru: `https://guruspaceai.cloud/privacy/guru`
3. **Target audience**:
   - siswa: hanya kelompok remaja yang benar-benar dilayani, tidak termasuk di bawah 13 tahun;
   - guru: kelompok dewasa.
4. Perbarui **Data safety** berdasarkan inventaris aplikasi dan SDK.
5. Periksa **Content rating** dan pastikan iklan maksimum sesuai rating aplikasi.
6. Pastikan store listing memakai domain developer `https://guruspaceai.cloud` agar crawler AdMob menemukan `app-ads.txt` pada root domain yang sama.
7. Berikan kredensial/instruksi akses aplikasi yang valid kepada tim review Google tanpa menaruh password di source atau dokumen publik.

## AdMob Console — tindakan pemilik akun

1. Pastikan kedua aplikasi dan package tertaut ke listing Play yang benar.
2. Pastikan Native Ad Unit siswa/guru berasal dari aplikasi yang sesuai.
3. Buka **Privacy & messaging**, publikasikan pesan regulasi yang relevan, dan pastikan privacy options diaktifkan bila diwajibkan.
4. Atur **Ad content rating** maksimum sesuai audiens remaja dan gunakan blocking controls untuk kategori sensitif.
5. Pada **Apps → app-ads.txt**, minta pemeriksaan ulang setelah deployment dan cache DNS/CDN diperbarui.
6. Gunakan Ad Inspector atau test device untuk pengujian. Jangan mengklik iklan produksi.

## Verifikasi `app-ads.txt` setelah deployment

Server lama memiliki kemungkinan file `app-ads.txt` tidak terlacak Git. Sebelum `git pull`, bandingkan lalu pindahkan file lama agar file yang dikelola repository dapat ditarik.

```bash
cd /www/wwwroot/guruspaceai.cloud/guruspaceai.cloud

test -f app-ads.txt && diff -u app-ads.txt public/app-ads.txt || true
test -f app-ads.txt && mv app-ads.txt app-ads.txt.server-backup

git pull --ff-only origin cursor/fix-teacher-student-account-flow
npm ci
npm run build
pm2 restart ecosystem.config.cjs --only guruspace
```

Kemudian verifikasi:

```bash
curl -fsS https://guruspaceai.cloud/app-ads.txt
curl -sS -D - -o /dev/null https://guruspaceai.cloud/app-ads.txt
curl -fsS https://guruspaceai.cloud/privacy/siswa >/dev/null
curl -fsS https://guruspaceai.cloud/privacy/guru >/dev/null
```

Expected:

- HTTP `200` tanpa redirect/login.
- `Content-Type: text/plain; charset=utf-8` untuk `app-ads.txt`.
- Isi tepat satu record Google DIRECT.
- Halaman Privacy Policy dapat dibuka tanpa login.

Jika Cloudflare masih menampilkan konten lama, purge hanya URL `/app-ads.txt`, lalu ulangi verifikasi. Jangan menonaktifkan keamanan atau cache seluruh situs.

## Keputusan

- Aplikasi siswa: **READY FOR CONSOLE FINALIZATION**, belum **READY TO PUBLISH** sampai deployment URL production, checklist Play Console/AdMob Console, dan status verifikasi `app-ads.txt` selesai.
- Aplikasi guru: **BLOCKED** untuk release beriklan sampai App ID AdMob guru yang unik tersedia dan AAB guru berhasil dibangun serta diverifikasi.

Status **READY TO PUBLISH** hanya boleh diberikan setelah seluruh tindakan pemilik akun selesai dan bukti production telah diperiksa; keberhasilan source/build saja tidak cukup.
