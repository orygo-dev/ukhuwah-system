# Panduan Deploy Navalogi di aaPanel, Apache, dan PM2

Panduan ini untuk server Linux dengan aaPanel, Apache sebagai reverse proxy, dan PM2 sebagai process manager Node.js.

## 1. Kebutuhan Server

- Node.js LTS 20 atau lebih baru.
- PM2 terpasang global.
- Database sesuai `DATABASE_URL` aplikasi.
- Domain sudah diarahkan ke IP server.
- Apache aktif di aaPanel.

```bash
node -v
npm -v
npm install -g pm2
pm2 -v
```

## 2. Ambil Project dari Git

Direkomendasikan project di server diambil dari repository Git agar update berikutnya cukup memakai `git pull`.

Contoh clone pertama kali:

```bash
cd /www/wwwroot
git clone <URL_REPOSITORY_ANDA> ukhuwah-system
cd /www/wwwroot/ukhuwah-system
```

Jika sebelumnya project sudah diupload manual, jadikan folder server sebagai working copy Git atau clone ulang ke folder baru, lalu pindahkan file `.env` dan folder upload produksi.

File/folder berikut tidak perlu masuk Git:

```bash
node_modules
.next
.env
public/uploads
```

## 3. Siapkan Environment

Buat file `.env` di root project:

```bash
cd /www/wwwroot/ukhuwah-system
cp .env.example .env
nano .env
```

Minimal pastikan variabel ini benar:

```env
DATABASE_URL="..."
AUTH_SECRET="..."
AUTH_URL="https://domainanda.com"
NEXTAUTH_URL="https://domainanda.com"
NEXT_PUBLIC_APP_URL="https://domainanda.com"
```

Isi juga API key AI, payment gateway, WhatsApp gateway, dan konfigurasi lain sesuai kebutuhan produksi.

## 4. Install Dependency dan Database

```bash
cd /www/wwwroot/ukhuwah-system
npm ci
npx prisma generate
npx prisma migrate deploy
```

`migrate deploy` hanya membuat tabel yang ada di `prisma/migrations`. Schema lokal yang disinkronkan dengan `npm run db:push` **tidak** ikut ke server. Jika log PM2 memuat `P2021` / `does not exist in the current database`, sinkronkan schema ke MySQL produksi:

```bash
npx prisma db push
```

Jika server baru dan butuh akun demo (bukan data dari komputer lokal), seed **sekali** dengan flag eksplisit. Tanpa flag ini `npm run db:seed` langsung gagal:

```bash
ALLOW_DEMO_SEED=true npx tsx prisma/seed.ts
```

Setelah itu set `ALLOW_DEMO_SEED=false` di `.env` produksi. Data guru dari MySQL lokal tidak ikut terupload; salin dengan `mysqldump` jika itu yang dibutuhkan.

## 5. Build Production

```bash
npm run build
```

Build harus selesai tanpa error. Jika build gagal karena cache, hapus `.next` lalu ulangi:

```bash
rm -rf .next
npm run build
```

## 6. Jalankan dengan PM2

Gunakan port internal `3112`:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Cek status:

```bash
pm2 status
pm2 logs ukhuwah-system
```

Restart setelah update:

```bash
pm2 restart ukhuwah-system
```

Port PM2 ditentukan di `ecosystem.config.cjs`:

```js
env: {
  NODE_ENV: "production",
  PORT: "3112",
}
```

Jika aaPanel PM2 Manager meminta form manual, isi seperti ini:

| Kolom aaPanel | Isi |
| --- | --- |
| Startup file | `/www/wwwroot/ukhuwahsystem.navalogi.id/ecosystem.config.cjs` |
| Run dir | `/www/wwwroot/ukhuwahsystem.navalogi.id` |
| Name | `ukhuwah-system` |
| Balance | `1` |
| MAX RAM | `1024` |
| User | `www` atau user server yang memang memiliki akses folder project |

Jika project ditempatkan di folder lain, sesuaikan `Startup file` dan `Run dir` dengan path project yang benar.

## 7. Apache Reverse Proxy di aaPanel

Di aaPanel:

1. Buka menu Website.
2. Pilih domain Navalogi.
3. Buka Config.
4. Tambahkan konfigurasi reverse proxy berikut di VirtualHost SSL/non-SSL yang sesuai.

```apache
ProxyPreserveHost On
ProxyRequests Off

ProxyPass / http://127.0.0.1:3112/
ProxyPassReverse / http://127.0.0.1:3112/

RequestHeader set X-Forwarded-Proto "https"
RequestHeader set X-Forwarded-Port "443"
```

Pastikan modul Apache berikut aktif:

```apache
proxy
proxy_http
headers
rewrite
ssl
```

Jika aaPanel menyediakan menu Reverse Proxy, bisa juga arahkan domain ke:

```text
http://127.0.0.1:3112
```

## 8. SSL

Aktifkan SSL di aaPanel menggunakan Let's Encrypt.

Setelah SSL aktif, pastikan `.env` memakai HTTPS:

```env
AUTH_URL="https://domainanda.com"
NEXTAUTH_URL="https://domainanda.com"
NEXT_PUBLIC_APP_URL="https://domainanda.com"
```

Lalu restart:

```bash
pm2 restart ukhuwah-system
```

## 9. Checklist Setelah Deploy

Buka halaman berikut:

- `https://domainanda.com/login`
- `https://domainanda.com/register`
- `https://domainanda.com/dashboard`
- `https://domainanda.com/admin`

Cek dari server:

```bash
curl -I https://domainanda.com/login
pm2 logs ukhuwah-system --lines 100
```

Login akun admin, lalu cek:

- Pengaturan AI.
- Payment gateway.
- WhatsApp gateway.
- Tampilan & Promo.
- Paket Langganan.
- Paket Kredit.

Login akun guru, lalu cek:

- Beranda.
- AI Assistant.
- Top Up Kredit.
- Paket Langganan.
- Afiliasi.
- Dompet.

## 10. Update Aplikasi

Update normal:

```bash
cd /www/wwwroot/ukhuwah-system
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:reconcile-check
npm run build
pm2 restart ecosystem.config.cjs --only ukhuwah-system
```

Update lebih aman dengan backup titik commit:

```bash
cd /www/wwwroot/ukhuwah-system
git status
git rev-parse --short HEAD
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:reconcile-check
npm run build
pm2 restart ecosystem.config.cjs --only ukhuwah-system
```

Jika update bermasalah dan perlu rollback ke commit sebelumnya:

```bash
cd /www/wwwroot/ukhuwah-system
git log --oneline -5
git reset --hard <COMMIT_SEBELUM_UPDATE>
npm ci
npx prisma generate
npm run build
pm2 restart ecosystem.config.cjs --only ukhuwah-system
```

**Penting:** Jangan memakai `prisma db push` di produksi. Gunakan `prisma migrate deploy` agar history migrasi dan skema tetap selaras. Jika `migrate status` bilang up to date tetapi kolom/tabel hilang (P2022), ikuti `docs/DB_RECONCILE_CHECKLIST.md`.

Catatan penting:

- Jangan commit `.env` ke Git.
- Jangan commit `node_modules`, `.next`, file log, zip backup, atau upload media produksi.
- Folder `public/uploads` di server berisi media user/branding produksi dan sebaiknya dibackup terpisah.
- Jika schema database berubah, jalankan `npx prisma migrate deploy` atau migrasi yang sesuai sebelum restart.

## 11. Troubleshooting

Jika halaman putih, CSS hilang, atau chunk error:

```bash
pm2 stop ukhuwah-system
rm -rf .next tsconfig.tsbuildinfo
npm run build
pm2 restart ukhuwah-system
```

Jika port 3112 bentrok:

```bash
pm2 delete ukhuwah-system
sed -i 's/PORT: "3112"/PORT: "3113"/' ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
```

Lalu ubah Apache reverse proxy ke port baru:

```apache
ProxyPass / http://127.0.0.1:3113/
ProxyPassReverse / http://127.0.0.1:3113/
```

Jika login callback error, cek:

- `AUTH_SECRET` sudah ada.
- `AUTH_URL` dan `NEXTAUTH_URL` sama dengan domain HTTPS.
- Jam server benar.
- Cookie tidak diblokir oleh konfigurasi proxy.
