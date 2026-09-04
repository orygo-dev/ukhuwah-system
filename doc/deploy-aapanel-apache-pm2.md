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
git clone <URL_REPOSITORY_ANDA> guruspace
cd /www/wwwroot/guruspace
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
cd /www/wwwroot/guruspace
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
cd /www/wwwroot/guruspace
npm ci
npx prisma generate
npx prisma migrate deploy
```

Jika server baru dan butuh data awal:

```bash
npm run db:seed
```

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

Gunakan port internal, misalnya `3000`:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Cek status:

```bash
pm2 status
pm2 logs guruspace
```

Restart setelah update:

```bash
pm2 restart guruspace
```

Port PM2 ditentukan di `ecosystem.config.cjs`:

```js
env: {
  NODE_ENV: "production",
  PORT: "3000",
}
```

Jika aaPanel PM2 Manager meminta form manual, isi seperti ini:

| Kolom aaPanel | Isi |
| --- | --- |
| Startup file | `/www/wwwroot/guruspaceai.cloud/guruspaceai.cloud/ecosystem.config.cjs` |
| Run dir | `/www/wwwroot/guruspaceai.cloud/guruspaceai.cloud` |
| Name | `guruspace` |
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

ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/

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
http://127.0.0.1:3000
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
pm2 restart guruspace
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
pm2 logs guruspace --lines 100
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
cd /www/wwwroot/guruspace
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:reconcile-check
npm run build
pm2 restart ecosystem.config.cjs --only guruspace
```

Update lebih aman dengan backup titik commit:

```bash
cd /www/wwwroot/guruspace
git status
git rev-parse --short HEAD
git pull
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:reconcile-check
npm run build
pm2 restart ecosystem.config.cjs --only guruspace
```

Jika update bermasalah dan perlu rollback ke commit sebelumnya:

```bash
cd /www/wwwroot/guruspace
git log --oneline -5
git reset --hard <COMMIT_SEBELUM_UPDATE>
npm ci
npx prisma generate
npm run build
pm2 restart ecosystem.config.cjs --only guruspace
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
pm2 stop guruspace
rm -rf .next tsconfig.tsbuildinfo
npm run build
pm2 restart guruspace
```

Jika port 3000 bentrok:

```bash
pm2 delete guruspace
sed -i 's/PORT: "3000"/PORT: "3001"/' ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
```

Lalu ubah Apache reverse proxy ke port baru:

```apache
ProxyPass / http://127.0.0.1:3001/
ProxyPassReverse / http://127.0.0.1:3001/
```

Jika login callback error, cek:

- `AUTH_SECRET` sudah ada.
- `AUTH_URL` dan `NEXTAUTH_URL` sama dengan domain HTTPS.
- Jam server benar.
- Cookie tidak diblokir oleh konfigurasi proxy.
