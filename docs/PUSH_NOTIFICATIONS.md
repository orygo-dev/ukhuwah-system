# Push notification GenPro

Implementasi ini memakai Firebase Cloud Messaging HTTP v1 untuk aplikasi Android dan Firebase Web Messaging untuk browser. Notifikasi internal tetap tersimpan di database, kemudian FCM mengirimkan pemberitahuan ke seluruh token aktif milik penerima.

## Konfigurasi server

1. Jalankan migrasi database:

   ```bash
   npx prisma migrate deploy
   ```

2. Di Firebase Console buka **Project settings → Service accounts → Generate new private key**.
3. Buka **Super Admin → Push Notifikasi**, lalu isi:
   - Project ID Firebase.
   - Seluruh isi file JSON service account, bukan legacy server key.
   - Android channel ID: `genpro_default`.
4. Aktifkan push dan simpan.

Sebagai alternatif, kredensial server dapat disediakan lewat `FCM_SERVICE_ACCOUNT_JSON` dan Project ID lewat `FCM_PROJECT_ID`. Kredensial service account harus hanya berada di server dan tidak boleh dimasukkan ke aplikasi Flutter atau repository publik.

## Android siswa

File Firebase Android harus berada di:

`mobile/guruspace_mobile/android/app/google-services.json`

Firebase Android App harus menggunakan package `com.genpro.app`. Setelah pengguna login, aplikasi meminta izin notifikasi, mendaftarkan token FCM ke server, memperbaruinya saat token berubah, dan menonaktifkannya saat logout.

Build aplikasi siswa:

```bash
cd mobile/guruspace_mobile
flutter build apk --release --flavor student -t lib/main.dart
```

## Browser/web

Tambahkan Web App pada Firebase project yang sama. Isi Web API Key, Auth Domain, Messaging Sender ID, Web App ID, dan public VAPID key di halaman Push Notifikasi. Browser hanya dapat menerima push pada HTTPS (localhost diperbolehkan untuk pengembangan), dan pengguna harus memberikan izin.

Setelah menyimpan, aktifkan push melalui ikon lonceng pada header. Tombol **Kirim notifikasi uji** di panel admin mengirim ke token aktif milik akun super admin yang sedang login.

## Pemeriksaan alur

- Penerbitan pemberitahuan baru dan penerbitan draf mengirim push ke penerima.
- Pengumuman PJJ dan hasil moderasi Spotlight juga mengirim push.
- Token FCM yang invalid atau sudah dicabut otomatis dinonaktifkan.
- Ketika aplikasi Android sedang terbuka, pesan ditampilkan sebagai local notification.
- Ketika notifikasi diketuk, aplikasi membuka pusat pemberitahuan GenPro.
