# Navalogi

Platform SaaS administrasi guru berbasis AI untuk Indonesia.

## Setup Cepat

```bash
npm install
cp .env.example .env
# Edit DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY

# Buat database MySQL: CREATE DATABASE guru_space;
npm run db:push
npm run db:generate
npm run db:seed
npm run dev
```

## Deploy aaPanel

Panduan production untuk Apache reverse proxy dan PM2 ada di
`doc/deploy-aapanel-apache-pm2.md`. Project ini juga menyediakan
`ecosystem.config.cjs` agar port PM2 jelas: default `3000`.

## Akun Demo (setelah seed)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@guruspace.id | admin123456 |
| Guru Demo | guru@demo.sch.id | guru123456 |

## Fitur

- **Auth** — NextAuth credentials + JWT, middleware proteksi route
- **AI Generate** — Multi-provider (OpenAI, Claude, Gemini) via Super Admin config
- **Demo Mode** — `DEMO_MODE=true` generate template tanpa API key
- **Dokumen** — CRUD, edit, arsip, export PDF & DOCX
- **Payment** — Midtrans Snap + webhook aktivasi langganan
- **Super Admin** — Pengaturan AI provider & payment gateway
- **Generator** — Modul Ajar, Bank Soal, LKPD, Jurnal, Narasi Rapor, Surat Dinas

## Setup AI Providers

### Via Super Admin (recommended)
1. Login `admin@guruspace.id`
2. `/admin/ai-settings`
3. Isi API key → **Test Koneksi** → **Simpan**
4. Aktifkan satu provider sebagai **Primary**

| Provider | API Key dari | Model contoh |
|----------|--------------|--------------|
| OpenAI | platform.openai.com | gpt-4o-mini |
| Gemini | aistudio.google.com | gemini-1.5-flash |
| OpenRouter | openrouter.ai | openai/gpt-4o-mini |

### Via .env (alternatif)
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
OPENROUTER_API_KEY=sk-or-...
DEMO_MODE=false
```

## Setup Payment

1. `/admin/payment-settings`
2. **Midtrans**: Server Key + Client Key (sandbox)
3. Aktifkan + set sebagai Default
4. Webhook URL: `https://domain Anda/api/payment/webhook/midtrans`

**Tripay** (opsional): API Key + Private Key + Merchant Code  
Webhook: `/api/payment/webhook/tripay`

| Method | Path | Deskripsi |
|--------|------|-----------|
| POST | `/api/auth/register` | Daftar akun baru |
| POST | `/api/generate` | Generate dokumen AI |
| GET | `/api/documents` | List dokumen user |
| GET/PATCH/DELETE | `/api/documents/[id]` | CRUD dokumen |
| GET | `/api/documents/[id]/export?format=pdf\|docx` | Export |
| POST | `/api/payment/create` | Buat transaksi Midtrans |
| POST | `/api/payment/webhook/midtrans` | Webhook pembayaran |
| GET/POST | `/api/admin/ai-providers` | Kelola AI (super admin) |
| GET/POST | `/api/admin/payment-gateways` | Kelola payment (super admin) |
| GET | `/api/plans` | List paket langganan |

## Environment Variables

```env
DATABASE_URL=mysql://root:password@localhost:3306/guru_space
AUTH_SECRET=random-32-chars-minimum
ENCRYPTION_KEY=random-32-chars-minimum
DEMO_MODE=true
OPENAI_API_KEY=          # opsional
MIDTRANS_SERVER_KEY=     # untuk payment sandbox
MIDTRANS_CLIENT_KEY=
```

## Halaman

- `/` — Landing
- `/dashboard` — Dashboard guru
- `/dashboard/tools/[slug]` — Generator per tool
- `/dashboard/documents` — Arsip dokumen
- `/dashboard/billing` — Langganan
- `/admin` — Super Admin
- `/admin/ai-settings` — Konfigurasi AI
- `/admin/payment-settings` — Konfigurasi payment
