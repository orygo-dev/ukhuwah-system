# GenPro landing page — implementasi & verifikasi

Tanggal: 29 Agustus 2026. Scope lanjutan: navigasi landing, halaman informasi publik, dan katalog paket read-only.

## Perbaikan tujuan tombol dan konten informasi

Masalah direproduksi dengan dua test gagal: tombol eksplorasi tidak memiliki tujuan informasi publik, dan konfigurasi tersimpan versi 2 mempertahankan anchor/billing lama. Root cause: desain sebelumnya hanya menyediakan teaser dan FAQ singkat, sementara CTA paket langsung mengarah ke dashboard terlindungi.

| Tombol | Tujuan dan isi |
| --- | --- |
| Fitur / Jelajahi Fitur / Kenali GenPro | `/fitur`: katalog kemampuan, peran, dan tautan penjelasan setiap fitur |
| Untuk Sekolah / Lihat Solusi Sekolah | `/untuk-sekolah`: peran admin/guru/siswa, administrasi, jadwal, akses, aktivasi dan PJJ |
| Aplikasi / Lihat Aplikasi | `/aplikasi`: akses web/Android, akun sesuai peran, URL resmi jika dikonfigurasi |
| Paket | `/paket`: perbandingan guru/sekolah dan katalog aktif |
| Lihat Paket Guru | `/paket/guru`: harga bulanan, kredit/bonus dan manfaat aktif |
| Katalog paket sekolah | `/paket/sekolah`: bulanan/tahunan, kapasitas guru/siswa, kredit AI, fitur sesuai data |
| Panduan akses siswa | `/panduan/siswa`: mendapatkan akun, masuk, kelas, Gabung PJJ, kendala sesi |
| Bantuan | `/bantuan`: akun, login, lisensi, transaksi, kehadiran, akses konten, jalur pelaporan |
| Kegiatan kelas / Zona Baca / Spotlight / AI | `/fitur/kelas`, `/fitur/zona-baca`, `/fitur/spotlight`, `/fitur/ai`: cara penggunaan, akses, batasan, dan langkah berikutnya |

### Batas perubahan

- Navigasi desktop/mobile dan CTA bawaan menuju halaman penjelasan yang dapat dibuka tanpa login. Tombol tindakan yang jelas bertuliskan masuk/daftar tetap menuju alur lama.
- Konfigurasi versi 3: upgrade read-time hanya untuk pasangan label+URL bawaan lama. Tautan khusus admin dipertahankan; versi 3 boleh sengaja mengatur kembali URL lama. Tidak ada migrasi, seed, atau penulisan konfigurasi oleh request publik.
- Katalog membaca `subscriptionPlan`/`schoolPlan` aktif dengan projection publik. Tidak membaca akun, invoice, transaksi, atau gateway. Fitur tak dikenal tidak diteruskan ke HTML.
- Guru hanya ditawarkan periode bulanan sesuai checkout yang sudah ada. Sekolah mengikuti feature flag komersialisasi. Harga sekolah nol tidak dipromosikan sebagai checkout gratis. Nilai harga invalid menjadi status unavailable, bukan Rp0.
- Status katalog membedakan ready, empty, disabled, unavailable. Kegagalan satu katalog tidak menghilangkan katalog lainnya. Tidak memakai harga statis landing lama.
- Nama/logo tetap dari pengaturan branding Super Admin. URL Android tetap dari pengaturan landing; tidak menebak tautan Play Store.
- Penjelasan Spotlight secara eksplisit mempertahankan kewajiban login/otorisasi. PJJ tetap maksimal 25 peserta. Tidak menjanjikan akses atau fitur tanpa lisensi.
- Tidak mengubah auth/proxy, register, checkout/payment webhook, dashboard, API bisnis, Prisma schema/migration, PM2/port, atau Android. Perubahan mobile yang sudah ada di workspace bukan bagian task ini.

### File lanjutan

- Route baru di `src/app/(informasi)/`: layout, fitur dan detail, untuk-sekolah, aplikasi, paket dan kategori, bantuan, panduan/siswa.
- `src/components/marketing/information-page.tsx`, `package-page.tsx`, `information-page.module.css`.
- `src/lib/landing-information.ts` (copy panduan), `landing-catalog.ts` (read-only data).
- Perubahan navigasi: `landing-navigation.tsx`, `landing-page-view.tsx`, `landing-faq.tsx`, `landing-experience.ts`.
- Kompatibilitas konfigurasi: `landing-page.shared.ts`, `landing-page.schema.ts`.
- `tests/landing-page.test.ts`, dokumen ini.

### Race condition dan resource

- Tidak ada mutation, polling, timer, atau listener baru pada halaman panduan/katalog. Server components memuat data; katalog memakai React cache per request, bukan cache lintas pengguna yang menyimpan harga lama.
- Katalog guru/sekolah memakai Suspense terpisah. Gagal database menghasilkan pesan aman tanpa secret atau exception mentah.
- Normalisasi tidak memutasi konfigurasi sumber; test idempotensi dan custom-link preservation lulus. Revision guard cache setting dan cleanup menu/FAQ/editor yang sudah ada tetap diuji.
- Harga bisa berubah antara melihat katalog dan checkout; pengunjung diminta memeriksa ringkasan transaksi. Otoritas harga dan akses tetap endpoint checkout lama, tidak ditentukan tautan publik.

### Verifikasi lanjutan

- **155/155 automated regression tests PASS**: 29 landing/information/catalog tests serta 126 test Spotlight, PJJ, keamanan/session, presence, komersialisasi sekolah, dan MCQ.
- `npm run build` **PASS** dan mendaftarkan seluruh route informasi baru sebagai dynamic public routes.
- TypeScript **PASS**, targeted ESLint **PASS**, `git diff --check` **PASS**. Peringatan yang tersisa adalah deprecation konfigurasi Prisma dan warning localstorage worker build yang sudah ada; bukan error perubahan ini.
- Browser build produksi: `/` tampil, menu dan seluruh CTA bawaan terlihat dengan URL baru; klik **Jelajahi Fitur** membuka `/fitur` dan menampilkan penjelasan berbeda. Layout desktop 1440×1000 diperiksa tanpa error console atau masalah visual pada viewport yang dilihat.
- Browser `/paket` menampilkan status katalog guru `unavailable` dan sekolah `disabled` secara jujur ketika database/feature flag lokal tidak tersedia; tidak menampilkan harga palsu. Navigasi header menuju halaman tersebut berhasil.
- Browser seluler 390×844: menu buka/tutup bekerja, tautan **Bantuan** membuka `/bantuan`, menu menutup setelah navigasi, dan halaman tujuan menampilkan konten yang relevan. Tidak ada error/warning aplikasi di console. Ini validasi browser responsif, bukan pengujian perangkat Android fisik.
- Database lokal tidak tersedia, sehingga katalog dengan data MySQL aktual dan checkout nyata **NOT TESTED**. Katalog produksi akan membaca data paket aktif saat runtime; endpoint checkout/otorisasi tidak diubah.

## Catatan implementasi awal (historis)

Bagian di bawah merekam hasil redesign awal sebelum perbaikan tujuan tombol. Status browser awal tidak mewakili hasil pemeriksaan lanjutan.

## Perubahan

- Desain putih/biru mengikuti konsep: hero, empat peran, alur belajar, kelas, Zona Baca, Spotlight, AI, web/Android, pilihan paket guru/sekolah, akses sesuai peran, panduan, dan footer.
- Nama/logo dibaca dari `app_display.branding` yang sudah dikelola Super Admin. Fallback khusus landing adalah GenPro dengan logo yang diberikan pengguna. Tidak mengganti default branding global atau menulis pengaturan saat halaman dibaca.
- Judul, kedua CTA, deskripsi, bagian fitur, paket, footer dan tautan Android mengikuti editor `/admin/landing-page`.
- Tanpa URL Android resmi, tombol membuka panduan akses siswa. Tidak menebak URL Play Store, membuat pendaftaran siswa, atau mengubah aplikasi Android.
- Paket ditampilkan sebagai dua pilihan, bukan harga/kuota statis. Pembelian tetap melalui dashboard dan otorisasi yang sudah ada. Daftar harga landing lama tetap tersimpan, tetapi tidak ditampilkan sebagai harga aktif.
- Konfigurasi versi 2 bersifat kompatibel: nilai yang persis sama dengan default lama disesuaikan saat dibaca, konten khusus tetap dipertahankan. Tidak ada migrasi/seed/database write otomatis. Nilai lama boleh digunakan kembali secara sengaja setelah disimpan dengan versi 2.
- Pengaturan gagal dimuat memiliki pesan dan tombol coba lagi; request dibatasi 20 detik, dibatalkan saat unmount, serta tombol simpan/reset dikunci selama request berjalan.
- Validasi URL menolak script, URL protocol-relative, kredensial URL, backslash dan karakter kontrol. Konfigurasi parsial/rusak tidak meruntuhkan halaman publik.
- Metadata dan pengaturan zoom hanya diubah untuk homepage. CSS memakai module, tidak mengubah stylesheet atau komponen layout bersama.

## File

- `src/app/page.tsx`
- `src/components/marketing/landing-page-view.tsx`
- `src/components/marketing/landing-page.module.css`
- `src/components/marketing/landing-navigation.tsx`
- `src/components/marketing/landing-previews.tsx`
- `src/components/marketing/landing-faq.tsx`
- `src/components/admin/landing-page-settings-client.tsx`
- `src/app/api/admin/landing-page/route.ts`
- `src/lib/landing-page.ts`, `landing-page.shared.ts`, `landing-page.schema.ts`, `landing-experience.ts`
- `public/landing/genpro-logo.png`, `public/landing/editorial-art.webp`
- `tests/landing-page.test.ts`

## Bukti masalah dan perbaikan

| Masalah | Penyebab | Perbaikan / bukti |
| --- | --- | --- |
| Judul Super Admin tidak muncul | Hero lama memakai teks hardcoded | Test rendering gagal sebelum perubahan, lulus setelah judul/CTA diambil dari konfigurasi |
| Konten baru dapat tertimpa cache lama | Read lambat selesai setelah save dan mengisi ulang cache dengan snapshot lama | Test konkurensi gagal sebelum fix; revision guard mencegah read lama menggantikan cache hasil save; test lulus |
| Editor membawa modul server | Konstanta UI dan akses Prisma berada dalam modul yang sama | Shared config/schema dipisahkan dari modul database; build dan lint lulus |
| Tombol panduan tidak selalu membuka jawaban | Navigasi hash dan pengulangan hash yang sama memerlukan penanganan eksplisit | Anchor native, handler hash/click dan cleanup listener; test DOM terisolasi lulus; navigasi browser ke halaman bantuan lulus |
| Risiko loading berputar tanpa penjelasan | Load editor lama tidak memiliki catch/finally atau timeout | Error/retry, AbortController, timeout dan finally; tes success/error/timeout/unmount lulus |

## Pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| 19 tes landing: rendering, migrasi konfigurasi kompatibel, branding, URL, role API, save/reset, failure, cache race, request cleanup, menu mobile dan FAQ terisolasi | PASS |
| 126 regresi: Spotlight, PJJ, keamanan/login/mobile session, presence, komersialisasi sekolah, MCQ | PASS |
| `npm run build` (Next production build + TypeScript) | PASS |
| TypeScript `tsc --noEmit` | PASS |
| ESLint seluruh file berubah | PASS, 0 error/warning; menggunakan flat config eksternal yang kompatibel dengan Next 16 karena config repo lama bermasalah |
| `git diff --check` | PASS |
| Homepage Next lokal, HTTP 200 dan konten tampil, 1440×1000 | PASS pada build development yang diperiksa |
| Visual desktop: logo, hero, dua CTA, pratinjau dashboard/ponsel, awal bagian peran | Diperiksa; mengikuti komposisi dan palet konsep |
| Layar 390×844 | Menu seluler dan hero tampil tanpa clipping yang terlihat; bukan pengujian perangkat Android fisik |
| Console browser `/`, `/fitur`, `/paket`, `/bantuan` | PASS — tidak ada error/warning aplikasi yang tercatat |
| CTA Jelajahi Fitur dan navigasi Paket | PASS — membuka `/fitur` dan `/paket` dengan konten berbeda yang relevan |
| Menu seluler dan navigasi Bantuan | PASS — menu membuka, menutup setelah klik, dan `/bantuan` tampil dengan konten bantuan |
| Simpan pengaturan melalui akun Super Admin dan database nyata | NOT TESTED — MySQL lokal `localhost:3306` tidak tersedia; tes handler menggunakan boundary auth/database yang dimock |
| Deployment/server produksi | NOT TESTED / tidak dilakukan |

Perintah regresi:

```sh
node --import tsx --test tests/landing-page.test.ts tests/spotlight-flow.test.ts tests/pjj/*.test.ts tests/security/*.test.ts tests/student-presence.test.ts tests/school-commercialization/*.test.ts tests/mcq-options.test.ts
npm run build
```

Build pertama sempat gagal pada Prisma `EPERM` karena dev server masih memegang DLL Windows. Dev server milik task dihentikan; build berikutnya berhasil tanpa menghapus DLL atau mengubah Prisma. Warning deprecation `package.json#prisma` dan warning lingkungan Node `--localstorage-file` tidak menggagalkan build.

## Visual dan aset

Font mengikuti Plus Jakarta Sans yang sudah dipakai aplikasi. Putih `#fff`, teks navy `#0c1b3a`, biru `#0865f5`, panel ice-blue `#eff7ff`, footer `#032644`. Radius media 12–18 px. Header desktop menjadi menu ringkas di mobile; konten dua kolom berurutan pada layar kecil. Animasi tidak diperlukan untuk penggunaan halaman.

Konsep dibandingkan dengan screenshot hero desktop menggunakan `view_image`. Perbedaan yang disengaja: GenPro menggantikan nama mockup lama sesuai koreksi pengguna; sampul adalah ilustrasi orisinal, bukan novel komersial; tautan unduhan kosong menjadi panduan; footer memakai rute nyata, bukan tautan ketentuan kosong; panduan tambahan menjelaskan CTA sekolah/Zona Baca/Spotlight. Audit browser build produksi terbaru memeriksa desktop dan viewport seluler tanpa error console atau masalah visual yang terlihat pada bagian yang diuji.

Logo: salinan logo GenPro yang diberikan pengguna, tidak mengubah file asli. Ilustrasi: dibuat dengan built-in Image Gen, dikompresi WebP menjadi sekitar 720 KB; satu atlas digunakan ulang untuk sampul dan karya contoh. Semua angka pada pratinjau adalah data contoh, bukan metrik pengguna aktual. Tidak mengambil konten/siswa privat.

Prompt aset final:

> Use case illustration-story. Production image atlas for an Indonesian education website GenPro. Extra-wide 3:1 rectangle, exactly six perfectly equal vertical panels touching edge-to-edge, no gaps, each portrait 1:2 aspect ratio, all same height. Left-to-right six original soft editorial hand-painted illustrations: 1 quill pen and ink bottle with green hills at dawn; 2 turquoise mountain landscape with river and botanical trees; 3 golden Indonesian sailboat on calm lake framed by hills; 4 cream paper poetry page with feather pen and delicate botanical foliage; 5 four comic-style panels of fictional friendly teenage students discussing a science project; 6 sunny yellow creative science poster with planet, book, botanical leaves. No readable text, no typography, no title labels, no real commercial book art, no logos. Full bleed each panel, clear vertical panel boundaries at exactly 1/6 width. Refined textured paper visual, teal mint gold navy accents, professional inviting educational editorial art. These six panels will be used as decorative book cover / Spotlight thumbnail sprites, labels added separately in HTML. Entire image consists only of these six equal panels.

## Batas dan tindak lanjut

1. Login, dashboard, pembayaran, PJJ, Android, schema database, port/PM2, dan shared marketing header/footer tidak diubah. Perubahan mobile yang sudah ada di worktree bukan bagian pekerjaan ini.
2. Tes terisolasi bukan bukti E2E database/browser produksi. Jangan menyatakan seluruh aplikasi bebas bug atau siap produksi berdasarkan hasil ini.
3. Verifikasi lanjutan yang masih diperlukan adalah data paket dari MySQL aktual, checkout nyata, perangkat Android fisik, keyboard/accessibility menyeluruh, serta simpan/reload konfigurasi lewat akun Super Admin nyata.
4. Isi URL aplikasi Android resmi melalui editor bila ingin tombol menuju listing aplikasi. Pastikan harga/manfaat paket benar pada dashboard masing-masing.
5. Pengeditan konfigurasi lintas tab tetap last-write-wins seperti sebelumnya; cache per proses dapat membutuhkan hingga 60 detik pada instance lain. Revision guard melindungi race read/save dalam satu proses, bukan menambahkan distributed locking.
6. Verifikasi di atas dilakukan lokal, tanpa deployment, migration, atau perubahan server. Keterbatasan verifikasi tetap berlaku setelah commit/push.
