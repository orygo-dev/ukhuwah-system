# Navalogi Provider API v1

Endpoint ini membuat Navalogi menjadi provider generator untuk aplikasi lain, termasuk Navalogi.

## Endpoint

`POST /api/provider/v1/generate`

Header:

```http
Authorization: Bearer <GURUSPACE_PROVIDER_API_KEY>
Content-Type: application/json
```

Alternatif header API key:

```http
X-GuruSpace-Api-Key: <GURUSPACE_PROVIDER_API_KEY>
```

## Payload

```json
{
  "toolSlug": "modul-ajar",
  "data": {
    "sekolah": "SMP Negeri 1 Contoh",
    "namaGuru": "Budi Santoso",
    "jenjang": "smp",
    "kelas": "7",
    "mapel": "IPA",
    "semester": "ganjil",
    "tahunAjaran": "2026/2027",
    "alokasiWaktu": "2 JP",
    "jumlahPertemuan": 2,
    "topik": "Klasifikasi makhluk hidup",
    "dimensiProfilLulusan": "Beriman dan bertakwa kepada Tuhan YME|Bernalar kritis",
    "modelPembelajaran": "Problem Based Learning"
  },
  "externalTenantId": "genpro-school-001",
  "externalUserId": "teacher-001",
  "externalRequestId": "genpro-request-001",
  "metadata": {
    "source": "genpro"
  }
}
```

`externalRequestId` bersifat idempotency key per client. Jika request yang sama sudah pernah berhasil, Navalogi akan menolak duplikasi dengan `409 DUPLICATE_EXTERNAL_REQUEST`.

## Response sukses

```json
{
  "ok": true,
  "requestId": "uuid",
  "provider": {
    "client": "genpro",
    "providerUsed": "OpenAI",
    "isDemo": false
  },
  "billing": {
    "creditCost": 1,
    "usedCredits": 12,
    "monthlyCreditLimit": 1000
  },
  "document": {
    "title": "Modul Ajar ...",
    "content": "# MODUL AJAR ...",
    "toolSlug": "modul-ajar",
    "metadata": {}
  }
}
```

## Response error

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Data modul-ajar belum lengkap: ..."
  }
}
```

Kode utama:

- `MISSING_API_KEY`: API key tidak dikirim.
- `INVALID_API_KEY`: API key salah.
- `CLIENT_INACTIVE`: client tidak aktif.
- `SUBSCRIPTION_EXPIRED`: masa akses client berakhir.
- `TOOL_NOT_ALLOWED`: client tidak memiliki akses tool.
- `PROVIDER_QUOTA_EXCEEDED`: kuota kredit provider habis.
- `TOOL_INACTIVE`: tool dimatikan dari Super Admin Navalogi.
- `INVALID_REQUEST`: payload tidak valid atau field wajib belum lengkap.
- `GENERATION_FAILED`: proses AI/provider gagal.

## Membuat client provider

Jalankan di server Navalogi:

```bash
npm run provider:create-client -- --name="Navalogi" --slug=genpro --credits=1000 --tools=modul-ajar --days=30
```

Script akan menampilkan API key satu kali. Navalogi hanya menyimpan hash API key di database.

Setelah schema berubah, jalankan:

```bash
npx prisma db push
npm run build
```
