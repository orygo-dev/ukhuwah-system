# Dokumentasi API Navalogi untuk Flutter

Versi dokumen: 1.0
Basis kode: commit `d48d9e88`
Base URL produksi: `https://guruspaceai.cloud`
Format utama: JSON UTF-8, kecuali upload (`multipart/form-data`), PDF, dan SSE.

## 1. Status dan batasan API saat ini

Route di dokumen ini adalah kontrak yang benar-benar tersedia pada aplikasi Next.js saat dokumen dibuat. Facade dashboard mobile tersedia pada `/api/mobile/v1`; endpoint fitur tetap menggunakan route bersama aplikasi web. Autentikasi akun utama menggunakan sesi JWT Auth.js yang disimpan dalam cookie HTTP-only.

Beberapa halaman web masih mengambil data melalui Prisma langsung di Server Component. Karena itu, aplikasi Flutter belum dapat mencapai kesetaraan fitur hanya dengan endpoint yang ada. Daftar kekurangan kritis tersedia di bagian **15. Gap API untuk Flutter**.

## 2. Konvensi umum

### 2.1 Header

Untuk JSON:

```http
Accept: application/json
Content-Type: application/json
```

Untuk endpoint yang memerlukan login, kirim kembali seluruh cookie yang diterima saat proses login. Jangan membaca atau membuat nilai cookie sesi secara manual.

### 2.2 Tanggal dan waktu

- Tanggal saja: `YYYY-MM-DD`, contoh `2026-07-29`.
- Date-time: ISO 8601, contoh `2026-07-29T08:00:00.000Z`.
- Waktu dari server umumnya UTC. Konversikan ke zona pengguna di Flutter.

### 2.3 ID

Sebagian besar ID adalah CUID/string. Perlakukan semua ID sebagai `String`; jangan mengasumsikan panjang tetap.

### 2.4 Error

Format error yang paling umum:

```json
{
  "error": "Pesan kesalahan"
}
```

Kode status:

| Status | Makna |
|---|---|
| `200` | Berhasil |
| `201` | Data berhasil dibuat |
| `400` | Payload/query tidak valid |
| `401` | Belum login, cookie hilang, atau sesi kedaluwarsa |
| `403` | Role tidak berhak |
| `404` | Data tidak ditemukan atau sengaja disamarkan karena di luar lingkup akun |
| `409` | Konflik status, sudah dikerjakan, sudah dinilai, atau waktu ditutup |
| `429` | Batas pemakaian/kuota terlampaui |
| `500` | Kesalahan internal server |

Client Flutter harus membaca `error` jika tersedia dan tidak bergantung pada teks error untuk logika bisnis. Gunakan status HTTP sebagai dasar alur.

## 3. Role dan lingkup akses

Nilai `UserRole`:

| Role | Fungsi |
|---|---|
| `SUPER_ADMIN` | Pengelola platform dan bank konten global |
| `PROVINCE_ADMIN` | Admin Dinas/Provinsi |
| `SCHOOL_ADMIN` | Admin sekolah |
| `TEACHER` | Guru |
| `STUDENT` | Siswa |

Kelompok akses yang sering digunakan:

- **Teacher workspace**: `TEACHER`, `SUPER_ADMIN`.
- **School staff**: `TEACHER`, `SCHOOL_ADMIN`, `SUPER_ADMIN`.
- **Pengelola pemberitahuan**: `SUPER_ADMIN`, `PROVINCE_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`.
- **Pengelola TKA**: `TEACHER`, `SCHOOL_ADMIN`, `SUPER_ADMIN`.

Data tetap dibatasi menurut sekolah, kelas, pemilik, atau penugasan walaupun role lolos.

## 4. Autentikasi akun utama (Auth.js cookie session)

### 4.1 Urutan login

Flutter wajib memakai cookie jar yang sama untuk semua langkah berikut.

#### Langkah 1 — ambil CSRF token

```http
GET /api/auth/csrf
```

Respons:

```json
{
  "csrfToken": "..."
}
```

Simpan cookie dari respons ini.

#### Langkah 2 — callback credentials

```http
POST /api/auth/callback/credentials
Content-Type: application/x-www-form-urlencoded
X-Auth-Return-Redirect: 1
```

Form fields:

| Field | Wajib | Isi |
|---|---:|---|
| `csrfToken` | Ya | Token dari langkah 1 |
| `email` | Ya | Email akun, server menormalisasi ke lowercase |
| `password` | Ya | Password |
| `callbackUrl` | Ya | Gunakan `/` untuk Flutter |

Respons Auth.js berupa JSON yang mengandung `url`. Login dianggap berhasil jika status `2xx`, URL tidak mengandung parameter `error`, dan endpoint session pada langkah berikut mengembalikan `user`.

#### Langkah 3 — validasi sesi

```http
GET /api/auth/session
```

Contoh respons:

```json
{
  "user": {
    "id": "cm...",
    "email": "siswa@sekolah.sch.id",
    "name": "Nama Siswa",
    "role": "STUDENT",
    "schoolId": "cm...",
    "studentId": "cm...",
    "creditsRemaining": 0,
    "avatarUrl": null,
    "membershipPlan": null
  },
  "expires": "2026-08-28T...Z"
}
```

`schoolId` dan `studentId` dapat `null`. Aplikasi harus menolak masuk ke fitur siswa jika role `STUDENT` tetapi `studentId` belum terhubung.

### 4.2 Logout

1. Ambil CSRF baru dari `GET /api/auth/csrf`.
2. Kirim form POST ke `/api/auth/signout` dengan `csrfToken` dan `callbackUrl=/` serta header `X-Auth-Return-Redirect: 1`.
3. Hapus cookie jar lokal setelah server merespons.

### 4.3 Registrasi guru

`POST /api/auth/register` — publik.

```json
{
  "name": "Nama Guru",
  "email": "guru@example.com",
  "password": "minimal8karakter",
  "phone": "081234567890",
  "schoolId": "school-id",
  "jenjang": "SMA",
  "mapel": "Matematika",
  "referralCode": "OPSIONAL"
}
```

Respons `201`:

```json
{
  "user": {
    "id": "...",
    "email": "guru@example.com",
    "name": "Nama Guru"
  }
}
```

Registrasi tidak otomatis membuat sesi; lanjutkan dengan alur login.

## 5. Contoh client Flutter dengan Dio

Dependency yang disarankan:

```yaml
dependencies:
  dio: ^5.0.0
  dio_cookie_manager: ^3.0.0
  cookie_jar: ^4.0.0
  path_provider: ^2.0.0
```

Gunakan versi stabil terbaru yang kompatibel dengan SDK Flutter proyek.

```dart
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path_provider/path_provider.dart';

class NavalogiApi {
  NavalogiApi._(this.dio, this.cookieJar);

  final Dio dio;
  final PersistCookieJar cookieJar;

  static Future<NavalogiApi> create() async {
    final dir = await getApplicationSupportDirectory();
    // FileStorage memudahkan contoh. Untuk produksi, lindungi direktori ini
    // dengan penyimpanan terenkripsi/platform secure storage.
    final jar = PersistCookieJar(
      storage: FileStorage('${dir.path}/guruspace_cookies'),
    );
    final dio = Dio(BaseOptions(
      baseUrl: 'https://guruspaceai.cloud',
      headers: {'Accept': 'application/json'},
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 30),
      validateStatus: (status) => status != null && status < 500,
    ));
    dio.interceptors.add(CookieManager(jar));
    return NavalogiApi._(dio, jar);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final csrf = await dio.get<Map<String, dynamic>>('/api/auth/csrf');
    final token = csrf.data?['csrfToken'] as String?;
    if (token == null) throw Exception('CSRF token tidak tersedia');

    final callback = await dio.post<Map<String, dynamic>>(
      '/api/auth/callback/credentials',
      data: {
        'csrfToken': token,
        'email': email,
        'password': password,
        'callbackUrl': '/',
      },
      options: Options(
        contentType: Headers.formUrlEncodedContentType,
        headers: {'X-Auth-Return-Redirect': '1'},
      ),
    );
    final redirectUrl = callback.data?['url']?.toString() ?? '';
    if (callback.statusCode! >= 400 || redirectUrl.contains('error=')) {
      throw Exception('Email atau password salah');
    }

    final session = await dio.get<Map<String, dynamic>>('/api/auth/session');
    final user = session.data?['user'];
    if (user is! Map) throw Exception('Sesi login tidak terbentuk');
    return Map<String, dynamic>.from(user);
  }

  Future<Response<T>> getJson<T>(String path,
      {Map<String, dynamic>? query}) {
    return dio.get<T>(path, queryParameters: query);
  }

  Future<Response<T>> postJson<T>(String path, Object? body) {
    return dio.post<T>(path, data: jsonEncode(body),
      options: Options(contentType: Headers.jsonContentType));
  }
}
```

Jangan mencatat cookie, password, OTP, API key, atau token LiveKit ke log produksi.
`FileStorage` pada contoh bukan enkripsi dengan sendirinya; aplikasi produksi harus
memakai lapisan penyimpanan terenkripsi atau tidak mempersistenkan cookie sensitif.

## 6. Endpoint publik dan konfigurasi aplikasi

| Method | Endpoint | Query/body | Respons utama |
|---|---|---|---|
| GET | `/api/app-display` | — | Branding, banner, popup, splash screen, dan ikon Menu Cepat siswa |
| GET | `/api/plans` | — | Daftar paket langganan aktif |
| GET | `/api/credit-packages` | — | Paket kredit aktif |
| GET | `/api/school-directory` | `provinceId?`, `regencyId?`, `q?` | `provinces`, `regencies`, `schools` (maks. 5000 sekolah) |
| POST | `/api/auth/register` | JSON registrasi guru | `user` |
| POST | `/api/spotlight/posts/{id}/view` | — | Penambahan statistik view |

URL media seperti `/uploads/...` adalah path relatif. Bentuk URL final dengan base URL, misalnya `https://guruspaceai.cloud/uploads/...`.

`quickMenuIcons` berisi `revision` dan delapan URL berdasarkan key
`attendance`, `assignments`, `quiz`, `pjj`, `tka`, `reading`, `creations`, dan
`board`. Tambahkan `revision` sebagai cache key. Jika URL kosong atau gagal
dimuat, aplikasi wajib memakai ikon lokal bawaan agar navigasi tetap tersedia.

## 7. Profil, sekolah, dan anggota

### 7.1 Profil guru

`GET /api/profile` — semua akun bersesi; bentuk profil paling relevan untuk guru.

Respons: `{ profile, complete, missing, account }`.

`PATCH /api/profile` — hanya `TEACHER`.

```json
{
  "namaGuru": "Nama Guru",
  "nip": "",
  "phone": "081234567890",
  "schoolId": "...",
  "sekolah": "Nama Sekolah",
  "npsn": "",
  "alamatSekolah": "",
  "kota": "",
  "provinsi": "",
  "jenjang": "SMA",
  "mapel": "Matematika",
  "tahunAjaran": "2026/2027",
  "semester": "Ganjil",
  "kurikulum": "merdeka-dl"
}
```

Jika `schoolId` diberikan, identitas sekolah diambil ulang dari database; jangan mengandalkan nama sekolah dari client.

### 7.2 Profil mengajar dan direktori

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET, POST | `/api/profile/teaching-profiles` | Session; mutasi guru | Daftar/tambah penugasan mengajar |
| PATCH, DELETE | `/api/profile/teaching-profiles/{id}` | Guru pemilik | Ubah/hapus profil mengajar |
| GET | `/api/members` | Guru | Query `q`, `jenjang`, `mapel`, `page`, `limit` |
| GET | `/api/school-directory` | Publik | Filter provinsi/kabupaten/pencarian |

## 8. Kelas, absensi, tugas, kuis, ujian, dan penilaian

### 8.1 Kelas dan absensi

| Method | Endpoint | Akses | Input/ringkasan |
|---|---|---|---|
| GET, POST | `/api/attendance/classes` | School staff | Daftar/buat kelas |
| GET, PATCH, DELETE | `/api/attendance/classes/{id}` | School staff sesuai lingkup | Detail/ubah/nonaktifkan kelas |
| GET, POST | `/api/attendance/classes/{id}/students` | School staff | Daftar/tambah atau impor siswa |
| PATCH, DELETE | `/api/attendance/students/{id}` | School staff | Ubah/nonaktifkan siswa |
| GET, POST | `/api/attendance/sessions` | GET school staff; POST guru | Query GET: `date?`, `classRoomId?` |
| GET, PATCH | `/api/attendance/sessions/{id}` | GET school staff; PATCH guru | Detail dan simpan absensi |
| GET | `/api/attendance/report` | School staff | `classRoomId`, `from?`, `to?` |

Status absensi: `PRESENT`, `EXCUSED`, `SICK`, `ABSENT`.

### 8.2 Tugas

`POST /api/assignments` — guru:

```json
{
  "classRoomId": "...",
  "title": "Tugas Bab 1",
  "mapel": "Matematika",
  "description": "Instruksi tugas",
  "dueDate": "2026-08-10",
  "status": "PUBLISHED"
}
```

`GET /api/assignments?classRoomId=...` hanya school staff, bukan siswa.
`GET /api/assignments/{id}` mengembalikan `{ assignment }` beserta roster dan submission untuk monitoring guru.
`POST /api/student/assignments/{id}/submission` hanya siswa:

```json
{ "answer": "Jawaban siswa, maksimal 12000 karakter" }
```

`PATCH /api/assignments/{id}/submissions/{submissionId}` digunakan guru/super admin untuk nilai dan umpan balik.

### 8.3 Kuis dan ujian

Payload soal kuis/ujian:

```json
{
  "prompt": "Pertanyaan",
  "options": ["A", "B", "C", "D"],
  "correctOptionIndex": 1,
  "explanation": "Penjelasan opsional"
}
```

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET, POST | `/api/quizzes` | GET school staff; POST guru | Filter GET `classRoomId?`; POST berisi kelas, judul, mapel, deskripsi, status, questions (1–30) |
| POST | `/api/student/quizzes/{id}/attempt` | Siswa | `{ answers: [{ questionId, selectedOptionIndex }] }`; semua soal wajib dijawab |
| GET, POST | `/api/exams` | GET school staff; POST guru | Mirip kuis; ujian juga memiliki jadwal mulai/selesai |
| POST | `/api/student/exams/{id}/attempt` | Siswa | `{ answers: [{ questionId, selectedOptionIndex }] }`; satu attempt |

Status konten: `DRAFT`, `PUBLISHED`, `ARCHIVED`. Respons attempt berisi skor, jumlah benar, total soal, dan jawaban tersimpan sesuai endpoint.

### 8.4 Penilaian dan rapor

| Method | Endpoint | Akses | Query/body |
|---|---|---|---|
| GET, POST | `/api/grading/assessments` | GET school staff; POST guru | GET `classRoomId`; POST membuat komponen nilai |
| GET, PATCH, DELETE | `/api/grading/assessments/{id}` | School staff/guru pemilik | Detail dan nilai siswa |
| GET | `/api/grading/report` | School staff | `classRoomId`, `from?`, `to?`, `semester?`, `tahunAjaran?` |
| GET | `/api/grading/report/pdf` | School staff | Query laporan; respons PDF |

Jenis penilaian: `QUIZ`, `TUGAS`, `UTS`, `UAS`, `PROYEK`, `LAINNYA`.

## 9. Jurnal, dokumen, AI, chat, pembayaran, reward

### 9.1 Jurnal dan dokumen

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET, POST | `/api/journals` | GET school staff; POST guru | GET: `date?`, `classRoomId?`, `scope?`, `from?`, `to?`, `limit?` |
| GET, PATCH, DELETE | `/api/journals/{id}` | School staff/guru pemilik | Detail dan mutasi jurnal |
| GET | `/api/journals/export/pdf` | School staff | `classRoomId?`, `from?`, `to?`; PDF |
| GET | `/api/documents` | Teacher workspace | Daftar dokumen pengguna |
| GET, PATCH, DELETE | `/api/documents/{id}` | Pemilik/super admin | Detail, ubah status/judul, hapus |
| GET | `/api/documents/{id}/export` | Pemilik/super admin | Query `format=pdf|docx` sesuai dukungan dokumen |

### 9.2 AI dan chat guru

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/ai/status` | Session | Status layanan AI dan kuota akun |
| POST | `/api/generate` | Teacher workspace | Menjalankan alat AI internal; memakai kredit |
| GET | `/api/chat/conversations` | Guru | Daftar percakapan |
| POST | `/api/chat/conversations/start` | Guru | Memulai percakapan |
| GET, POST, PATCH | `/api/chat/conversations/{id}` | Guru pemilik | Riwayat, kirim pesan, ubah metadata |
| GET, PATCH | `/api/chat/settings` | Guru | Preferensi chat |
| GET | `/api/chat/stream` | Guru | Server-Sent Events; Flutter perlu client SSE/stream HTTP |
| GET | `/api/chat/unread` | Guru | Jumlah pesan belum dibaca |

Kontrak `/api/generate` bergantung pada slug alat AI dan konfigurasi platform. Ambil `/api/ai/status` dahulu dan jangan menaruh kunci provider AI di aplikasi Flutter.

### 9.3 Pembayaran, wallet, afiliasi, reward

| Method | Endpoint | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/payment/config` | Teacher workspace | Gateway aktif; rahasia tidak dikirim |
| POST | `/api/payment/create` | Teacher workspace | Membuat transaksi paket/kredit |
| GET, POST | `/api/payment/status/{id}` | Pemilik/super admin | Status dan sinkronisasi transaksi |
| GET | `/api/wallet/me` | Teacher workspace | Saldo dan ledger wallet |
| POST | `/api/wallet/convert` | Teacher workspace | Konversi wallet ke kredit |
| GET | `/api/affiliate/me` | Teacher workspace | Ringkasan afiliasi |
| POST | `/api/affiliate/payout` | Teacher workspace | Permintaan pencairan |
| GET | `/api/reward/me` | Teacher workspace | Misi, saldo, riwayat |
| POST | `/api/reward/claim` | Teacher workspace | Klaim misi |
| POST | `/api/reward/ad/session` | Teacher workspace | Buat sesi rewarded ad |
| POST | `/api/reward/ad/complete` | Teacher workspace | Selesaikan sesi iklan |

Jangan menganggap status pembayaran sukses hanya dari redirect aplikasi. Gunakan `/api/payment/status/{id}`; webhook gateway adalah sumber kebenaran server.

## 10. Pemberitahuan

### 10.1 Inbox dan lonceng

`GET /api/notifications?limit=12&unread=true`

Respons:

```json
{
  "items": [
    {
      "id": "recipient-id",
      "readAt": null,
      "notification": {
        "id": "notification-id",
        "title": "Judul",
        "message": "Isi",
        "category": "GENERAL",
        "priority": "NORMAL",
        "actionUrl": "/student/tka",
        "publishAt": "2026-07-29T08:00:00.000Z",
        "expiresAt": null,
        "sender": { "name": "Admin", "role": "SUPER_ADMIN" }
      }
    }
  ],
  "unreadCount": 1
}
```

Tandai dibaca:

```http
POST /api/notifications/read
```

Satu item: `{ "recipientId": "..." }`
Semua item: `{ "all": true }`

### 10.2 Membuat dan mengelola

`POST /api/notifications` — role pengelola pemberitahuan:

```json
{
  "title": "Informasi TKA",
  "message": "Simulasi dimulai besok.",
  "category": "TKA",
  "priority": "IMPORTANT",
  "status": "PUBLISHED",
  "targetType": "CLASS",
  "targetRole": null,
  "schoolId": null,
  "classRoomId": "...",
  "actionUrl": "/student/tka",
  "publishAt": null,
  "expiresAt": null
}
```

Enum:

- Category: `GENERAL`, `ACADEMIC`, `ASSIGNMENT`, `TKA`, `PJJ`, `READING`, `ADMINISTRATION`, `EVENT`.
- Priority: `NORMAL`, `IMPORTANT`, `URGENT`.
- Status: `DRAFT`, `PUBLISHED` (arsip melalui endpoint aksi).
- Target: `ALL`, `ROLE`, `SCHOOL`, `CLASS`.

Endpoint pengelolaan:

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/notifications/manage` | Kiriman yang boleh dikelola aktor |
| PATCH | `/api/notifications/{id}` | `{ "action": "publish" }` atau `{ "action": "archive" }` |

`actionUrl` harus path internal yang dimulai `/` atau URL HTTPS. Di Flutter, petakan path web ke named route aplikasi; jangan membuka path internal mentah tanpa validasi.

## 11. TKA

### 11.1 Bank soal

`GET /api/tka/subjects` — semua sesi.
`GET /api/tka/questions` — pengelola TKA sesuai scope.
`POST /api/tka/questions`:

```json
{
  "subjectId": "...",
  "classRoomId": "...",
  "scope": "CLASS",
  "type": "SINGLE_CHOICE",
  "stimulus": "Teks stimulus opsional",
  "prompt": "Pertanyaan minimal lima karakter",
  "options": ["A", "B", "C", "D"],
  "correctAnswers": [1],
  "explanation": "Pembahasan",
  "competency": "Kompetensi",
  "difficulty": "MEDIUM"
}
```

Scope: guru `CLASS`, admin sekolah `SCHOOL`, super admin `GLOBAL`.
Tipe: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`.
Difficulty: `EASY`, `MEDIUM`, `HARD`.

`PATCH /api/tka/questions/{id}`:

```json
{ "action": "SUBMIT", "reviewNote": "opsional" }
```

Action: `SUBMIT`, `APPROVE`, `PUBLISH`, `REJECT`, `ARCHIVE`. Server memvalidasi role dan transisi status.

### 11.2 Paket dan attempt siswa

Guru membuat paket:

```http
POST /api/tka/packages
```

```json
{
  "classRoomId": "...",
  "subjectId": "...",
  "title": "Simulasi TKA Matematika",
  "description": "opsional",
  "durationMinutes": 90,
  "questionIds": ["question-1", "question-2"]
}
```

Siswa memulai:

```http
POST /api/student/tka/attempts
```

```json
{ "packageId": "..." }
```

Simpan jawaban:

```http
PATCH /api/student/tka/attempts/{attemptId}
```

```json
{
  "action": "SAVE",
  "questionId": "...",
  "selectedAnswers": [1]
}
```

Kirim akhir:

```json
{ "action": "SUBMIT" }
```

Respons akhir: `{ result: { status, score, correctCount, totalQuestions } }`. Flutter harus memakai `expiresAt` dari attempt dan tetap menganggap keputusan waktu dari server sebagai sumber kebenaran.

## 12. Zona Baca

Semua endpoint Zona Baca memerlukan session walaupun beberapa nama route tidak memanggil `auth()` secara langsung; autentikasi dilakukan oleh helper `getReadingActor()`.

| Method | Endpoint | Akses | Kontrak |
|---|---|---|---|
| GET | `/api/reading/books` | Semua role bersesi | `{ books }` sesuai scope |
| POST | `/api/reading/books` | Guru/admin sekolah/super admin | Membuat bacaan |
| PATCH | `/api/reading/books/{id}` | Pengelola sesuai scope | `{ status, reviewNote? }` |
| POST | `/api/reading/upload` | Pengelola | Multipart `file`, `kind=cover|document` |
| POST | `/api/reading/favorites` | Siswa | `{ bookId }`, toggle favorit |
| POST | `/api/reading/progress` | Siswa | `{ bookId, progressPercent, currentPage, secondsReadDelta }` |
| POST | `/api/reading/assignments` | Guru/admin atau siswa | Payload dibedakan menurut role |

Payload membuat buku:

```json
{
  "title": "Judul Buku",
  "authorName": "Penulis",
  "description": "Deskripsi minimal sepuluh karakter",
  "category": "Literasi",
  "targetLevel": "SMA/SMK",
  "coverUrl": "/uploads/reading/cover/file.webp",
  "contentType": "PDF",
  "contentUrl": "/uploads/reading/document/file.pdf",
  "contentText": "",
  "pageCount": 50,
  "estimatedMinutes": 60,
  "licenseName": "",
  "rightsHolder": "",
  "sourceUrl": "",
  "scope": "CLASS",
  "classRoomId": "...",
  "status": "DRAFT"
}
```

Upload limits:

- Cover: JPEG/PNG/WebP, maksimal 5 MB, signature file diperiksa.
- Document: PDF, maksimal 25 MB, header `%PDF-` diperiksa.

Tugas baca guru/admin:

```json
{
  "bookId": "...",
  "classRoomId": "...",
  "title": "Tugas membaca",
  "instructions": "Instruksi",
  "dueAt": "2026-08-10T15:00:00.000Z"
}
```

Refleksi siswa ke endpoint yang sama:

```json
{
  "assignmentId": "...",
  "reflection": "Refleksi minimal dua puluh karakter"
}
```

## 13. PJJ dan LiveKit

### 13.1 Sesi PJJ guru

`GET /api/pjj/sessions` — guru, mengembalikan kelas PJJ/HYBRID beserta sesi.
`POST /api/pjj/sessions` — guru yang ditugaskan:

```json
{
  "classRoomId": "...",
  "title": "Kelas Matematika",
  "subject": "Matematika",
  "description": "Pembahasan bab 1",
  "scheduledStart": "2026-08-01T01:00:00.000Z",
  "scheduledEnd": "2026-08-01T03:00:00.000Z",
  "maxParticipants": 50,
  "minAttendancePercent": 70
}
```

Endpoint lingkup lain:

| Method | Endpoint | Akses |
|---|---|---|
| GET, POST | `/api/school/pjj` | Admin sekolah terkait |
| GET, POST | `/api/province/pjj` | Admin provinsi/super admin sesuai aksi |

### 13.2 Token LiveKit

```http
POST /api/livekit/token
```

```json
{ "liveSessionId": "..." }
```

Respons berisi kredensial koneksi (termasuk token dan URL dari helper LiveKit), `roomName`, `title`, `className`, dan `role`. Gunakan token hanya untuk sesi tersebut dan jangan simpan permanen.

Siswa boleh masuk mulai 30 menit sebelum jadwal hingga 2 jam setelah jadwal selesai. Status `CANCELLED`/`ENDED` ditolak.

Integrasi Flutter menggunakan SDK LiveKit Flutter. Alur:

1. Ambil daftar sesi dari API mobile yang sesuai (saat ini masih menjadi gap untuk siswa).
2. Minta `/api/livekit/token`.
3. Hubungkan SDK dengan `url` dan `token` dari server.
4. Putuskan room saat logout/keluar halaman.

## 14. Portal orang tua, mitra, admin, provider, dan webhook

### 14.1 Portal orang tua

Portal orang tua memakai cookie terpisah.

| Method | Endpoint | Kontrak |
|---|---|---|
| POST | `/api/parent/verify` | `{ "code": "kode-akses" }`; menyetel cookie dan mengembalikan ringkasan siswa |
| GET | `/api/parent/dashboard` | Memerlukan cookie orang tua; profil, semester, absensi, nilai |
| GET | `/api/parent/report/pdf` | Cookie orang tua; query `semester?`, `tahunAjaran?`; PDF |
| DELETE | `/api/parent/verify` | Logout/hapus cookie orang tua |

### 14.2 Portal mitra

| Method | Endpoint | Kontrak |
|---|---|---|
| POST | `/api/partner/login` | `{ "code": "MITRA", "password": "..." }`; menyetel cookie mitra |
| GET, PATCH | `/api/partner/me` | Profil dan pembaruan mitra |
| POST | `/api/partner/payout` | Permintaan pencairan mitra |
| POST | `/api/partner/logout` | Menghapus cookie mitra |

Gunakan cookie jar terpisah untuk akun utama, orang tua, dan mitra agar sesi tidak tercampur.

### 14.3 Endpoint Super Admin

Endpoint berikut tidak diperlukan untuk aplikasi siswa/guru biasa dan hanya boleh ditampilkan untuk role yang tepat.

| Endpoint | Method | Fungsi |
|---|---|---|
| `/api/admin/app-display` | GET, PATCH, POST | Branding, banner, popup, splash, ikon Menu Cepat |
| `/api/admin/landing-page` | GET, PATCH, POST | Konten landing page |
| `/api/admin/users` | POST | Membuat akun admin |
| `/api/admin/users/{id}` | PATCH | Mengubah akun/role |
| `/api/admin/school-directory` | GET, POST, PATCH, DELETE | Provinsi, kabupaten, sekolah |
| `/api/admin/plans` | GET, POST, PUT | Paket langganan |
| `/api/admin/credit-packages` | GET, POST | Paket kredit |
| `/api/admin/payment-gateways` | GET, POST | Konfigurasi gateway pembayaran |
| `/api/admin/ai-providers` | GET, POST, PUT | Provider AI |
| `/api/admin/ai-tool-configs` | GET, PUT | Konfigurasi alat AI |
| `/api/admin/ai-usage/balance-check` | POST | Pemeriksaan saldo provider |
| `/api/admin/livekit` | GET, PUT, POST | Konfigurasi dan tes LiveKit |
| `/api/admin/media/upload` | POST | Upload media tampilan aplikasi |
| `/api/admin/provider-clients` | GET, POST | Client Provider API dan rotasi key |
| `/api/admin/whatsapp-gateways` | GET, POST | Gateway WhatsApp dan tes |
| `/api/admin/reward` | GET, PATCH | Konfigurasi reward/misi/iklan |
| `/api/admin/affiliate` | GET, PATCH | Aturan afiliasi |
| `/api/admin/affiliate/partners` | GET, POST | Mitra afiliasi |
| `/api/admin/affiliate/payouts` | GET, POST | Pencairan afiliasi |

Secret yang diterima dari endpoint admin tidak boleh disimpan di log, analytics, crash report, atau secure storage lebih lama dari kebutuhan operasional.

### 14.4 Provider API dan webhook server-to-server

Endpoint ini bukan untuk dipanggil langsung dari aplikasi Flutter:

| Endpoint | Pemanggil | Keamanan |
|---|---|---|
| `POST /api/provider/v1/generate` | Aplikasi client terdaftar | API key provider; lihat `doc/GURUSPACE_PROVIDER_API.md` |
| `POST /api/livekit/webhook` | Server LiveKit | Signature webhook LiveKit |
| `POST /api/payment/webhook/midtrans` | Midtrans | Signature gateway |
| `POST /api/payment/webhook/tripay` | Tripay | Signature gateway |
| `GET /api/reward/ad/ssv` | Jaringan iklan | Signature/key SSV |

Menanam secret server-to-server di APK/IPA adalah pelanggaran keamanan.

## 15. Katalog seluruh route

Legenda akses: **Publik**, **Session**, **Orang tua**, **Mitra**, **Webhook/API key**, atau role khusus.

| Grup | Endpoint | Method | Akses/ringkasan |
|---|---|---|---|
| Auth | `/api/auth/[...nextauth]` | GET, POST | Publik; endpoint internal Auth.js (csrf, session, callback, signout) |
| Auth | `/api/auth/error` | GET | Publik; normalisasi error autentikasi |
| Auth | `/api/auth/register` | POST | Publik; registrasi guru |
| Public | `/api/app-display` | GET | Publik; tampilan aplikasi |
| Public | `/api/plans` | GET | Publik; paket aktif |
| Public | `/api/credit-packages` | GET | Publik; paket kredit |
| Public | `/api/school-directory` | GET | Publik; direktori sekolah |
| Profile | `/api/profile` | GET, PATCH | Session; PATCH guru |
| Profile | `/api/profile/teaching-profiles` | GET, POST | Session/guru |
| Profile | `/api/profile/teaching-profiles/{id}` | PATCH, DELETE | Guru pemilik |
| Members | `/api/members` | GET | Guru |
| Attendance | `/api/attendance/classes` | GET, POST | School staff |
| Attendance | `/api/attendance/classes/{id}` | GET, PATCH, DELETE | School staff |
| Attendance | `/api/attendance/classes/{id}/students` | GET, POST | School staff |
| Attendance | `/api/attendance/students/{id}` | PATCH, DELETE | School staff |
| Attendance | `/api/attendance/sessions` | GET, POST | School staff/guru |
| Attendance | `/api/attendance/sessions/{id}` | GET, PATCH | School staff/guru |
| Attendance | `/api/attendance/report` | GET | School staff |
| Assignment | `/api/assignments` | GET, POST | School staff/guru |
| Assignment | `/api/assignments/{id}` | GET | School staff |
| Assignment | `/api/assignments/{id}/submissions/{submissionId}` | PATCH | Guru/super admin |
| Assignment | `/api/student/assignments/{id}/submission` | POST | Siswa |
| Quiz | `/api/quizzes` | GET, POST | School staff/guru |
| Quiz | `/api/student/quizzes/{id}/attempt` | POST | Siswa |
| Exam | `/api/exams` | GET, POST | School staff/guru |
| Exam | `/api/student/exams/{id}/attempt` | POST | Siswa |
| Grading | `/api/grading/assessments` | GET, POST | School staff/guru |
| Grading | `/api/grading/assessments/{id}` | GET, PATCH, DELETE | School staff/guru |
| Grading | `/api/grading/report` | GET | School staff |
| Grading | `/api/grading/report/pdf` | GET | School staff; PDF |
| Journal | `/api/journals` | GET, POST | School staff/guru |
| Journal | `/api/journals/{id}` | GET, PATCH, DELETE | School staff/guru |
| Journal | `/api/journals/export/pdf` | GET | School staff; PDF |
| Documents | `/api/documents` | GET | Teacher workspace |
| Documents | `/api/documents/{id}` | GET, PATCH, DELETE | Pemilik/super admin |
| Documents | `/api/documents/{id}/export` | GET | Pemilik/super admin |
| Chat | `/api/chat/conversations` | GET | Guru |
| Chat | `/api/chat/conversations/start` | POST | Guru |
| Chat | `/api/chat/conversations/{id}` | GET, POST, PATCH | Guru pemilik |
| Chat | `/api/chat/settings` | GET, PATCH | Guru |
| Chat | `/api/chat/stream` | GET | Guru; SSE |
| Chat | `/api/chat/unread` | GET | Guru |
| AI | `/api/ai/status` | GET | Session |
| AI | `/api/generate` | POST | Teacher workspace |
| Notification | `/api/notifications` | GET, POST | Session/pengelola |
| Notification | `/api/notifications/read` | POST | Session |
| Notification | `/api/notifications/manage` | GET | Pengelola |
| Notification | `/api/notifications/{id}` | PATCH | Pemilik/super admin |
| Spotlight | `/api/spotlight/posts` | GET, POST | Teacher workspace/guru |
| Spotlight | `/api/spotlight/posts/{id}` | GET, DELETE | Teacher workspace/pemilik |
| Spotlight | `/api/spotlight/posts/{id}/comments` | GET, POST | Teacher workspace/guru |
| Spotlight | `/api/spotlight/posts/{id}/like` | POST | Guru |
| Spotlight | `/api/spotlight/posts/{id}/view` | POST | Publik |
| Mading siswa | `/api/student-board/posts` | GET, POST | School staff/guru |
| Mading siswa | `/api/student-board/posts/{id}` | PATCH | School staff |
| Mading siswa | `/api/student/board-posts` | POST | Siswa |
| Spotlight siswa | `/api/student-spotlight/submissions` | GET | School staff |
| Spotlight siswa | `/api/student-spotlight/submissions/{id}` | PATCH | School staff |
| Spotlight siswa | `/api/student/spotlight-submissions` | POST | Siswa |
| TKA | `/api/tka/subjects` | GET | Session |
| TKA | `/api/tka/questions` | GET, POST | Pengelola TKA |
| TKA | `/api/tka/questions/{id}` | PATCH | Pengelola TKA |
| TKA | `/api/tka/packages` | POST | Guru |
| TKA | `/api/student/tka/attempts` | POST | Siswa |
| TKA | `/api/student/tka/attempts/{id}` | GET, PATCH | Siswa pemilik |
| Reading | `/api/reading/books` | GET, POST | Session; POST pengelola |
| Reading | `/api/reading/books/{id}` | PATCH | Pengelola sesuai scope |
| Reading | `/api/reading/assignments` | POST | Guru/admin/siswa sesuai payload |
| Reading | `/api/reading/favorites` | POST | Siswa |
| Reading | `/api/reading/progress` | POST | Siswa |
| Reading | `/api/reading/upload` | POST | Pengelola; multipart |
| PJJ | `/api/pjj/sessions` | GET, POST | Guru |
| PJJ | `/api/school/pjj` | GET, POST | Admin sekolah |
| PJJ | `/api/province/pjj` | GET, POST | Admin provinsi/super admin |
| LiveKit | `/api/livekit/token` | POST | Peserta/pengelola sesi |
| LiveKit | `/api/livekit/webhook` | POST | Webhook LiveKit |
| Student account | `/api/students/{id}/account` | POST, PATCH | School staff sesuai aturan endpoint |
| Student account | `/api/students/accounts/bulk` | POST | Admin sekolah |
| Parent | `/api/students/{id}/parent-code` | POST, DELETE | School staff |
| Parent | `/api/parent/verify` | POST, DELETE | Publik/cookie orang tua |
| Parent | `/api/parent/dashboard` | GET | Cookie orang tua |
| Parent | `/api/parent/report/pdf` | GET | Cookie orang tua; PDF |
| OTP | `/api/otp/request` | POST | Session |
| OTP | `/api/otp/verify` | POST | Session |
| Plans/payment | `/api/payment/config` | GET | Teacher workspace |
| Plans/payment | `/api/payment/create` | POST | Teacher workspace |
| Plans/payment | `/api/payment/status/{id}` | GET, POST | Pemilik/super admin |
| Plans/payment | `/api/payment/webhook/midtrans` | POST | Webhook |
| Plans/payment | `/api/payment/webhook/tripay` | POST | Webhook |
| Wallet | `/api/wallet/me` | GET | Teacher workspace |
| Wallet | `/api/wallet/convert` | POST | Teacher workspace |
| Affiliate | `/api/affiliate/me` | GET | Teacher workspace |
| Affiliate | `/api/affiliate/payout` | POST | Teacher workspace |
| Reward | `/api/reward/me` | GET | Teacher workspace |
| Reward | `/api/reward/claim` | POST | Teacher workspace |
| Reward | `/api/reward/ad/session` | POST | Teacher workspace |
| Reward | `/api/reward/ad/complete` | POST | Teacher workspace |
| Reward | `/api/reward/ad/ssv` | GET | Signed callback jaringan iklan |
| Partner | `/api/partner/login` | POST | Publik; membuat cookie mitra |
| Partner | `/api/partner/logout` | POST | Cookie mitra |
| Partner | `/api/partner/me` | GET, PATCH | Cookie mitra |
| Partner | `/api/partner/payout` | POST | Cookie mitra |
| Provider | `/api/provider/v1/generate` | POST | API key provider |
| Admin | `/api/admin/affiliate` | GET, PATCH | Super admin |
| Admin | `/api/admin/affiliate/partners` | GET, POST | Super admin |
| Admin | `/api/admin/affiliate/payouts` | GET, POST | Super admin |
| Admin | `/api/admin/ai-providers` | GET, POST, PUT | Super admin |
| Admin | `/api/admin/ai-tool-configs` | GET, PUT | Super admin |
| Admin | `/api/admin/ai-usage/balance-check` | POST | Super admin |
| Admin | `/api/admin/app-display` | GET, PATCH, POST | Super admin |
| Admin | `/api/admin/credit-packages` | GET, POST | Super admin |
| Admin | `/api/admin/landing-page` | GET, PATCH, POST | Super admin |
| Admin | `/api/admin/livekit` | GET, PUT, POST | Super admin |
| Admin | `/api/admin/media/upload` | POST | Super admin |
| Admin | `/api/admin/payment-gateways` | GET, POST | Super admin |
| Admin | `/api/admin/plans` | GET, POST, PUT | Super admin |
| Admin | `/api/admin/provider-clients` | GET, POST | Super admin |
| Admin | `/api/admin/reward` | GET, PATCH | Super admin |
| Admin | `/api/admin/school-directory` | GET, POST, PATCH, DELETE | Super admin |
| Admin | `/api/admin/users` | POST | Super admin |
| Admin | `/api/admin/users/{id}` | PATCH | Super admin |
| Admin | `/api/admin/whatsapp-gateways` | GET, POST | Super admin |

### 15.1 Facade mobile v1

| Route | Method | Kegunaan |
|---|---|---|
| `/api/mobile/v1/bootstrap` | GET | User, context role, counters, feature flags, dan pengaturan tampilan |
| `/api/mobile/v1/student/dashboard` | GET | Ringkasan siswa, tugas, kuis, ujian, nilai, presensi, PJJ, TKA, dan Zona Baca |
| `/api/mobile/v1/student/learning/{kind}/{id}` | GET | Detail native tugas, quiz, atau ujian beserta submission/attempt siswa |
| `/api/mobile/v1/teacher/dashboard` | GET | Ringkasan guru, kelas, aktivitas siswa, presensi, penilaian, dan PJJ |

`GET /api/student/tka/attempts/{id}` mengembalikan metadata attempt, paket, soal yang sudah diurutkan, dan jawaban tersimpan. Respons soal sengaja tidak memuat `correctAnswers` atau `explanation` selama simulasi. Gunakan `PATCH` action `SAVE` untuk autosave dan action `SUBMIT` untuk penilaian final.

## 16. Gap API untuk Flutter

Endpoint berikut perlu ditambahkan sebelum aplikasi Flutter dianggap setara dengan web:

1. **Mobile auth versioned**: cookie session berfungsi untuk client native saat ini, tetapi access/refresh token yang dapat dicabut masih diperlukan untuk kontrak mobile jangka panjang.
2. **Bootstrap bearer token**: facade bootstrap berbasis cookie sudah tersedia, tetapi access/refresh token native yang dapat dicabut belum tersedia.
3. **Dashboard role lanjutan**: dashboard siswa dan guru sudah tersedia; admin sekolah dan admin dinas belum menjadi scope aplikasi mobile tahap awal.
4. **Detail fitur pembelajaran**: detail/submit tugas, quiz, ujian, dan simulasi TKA sudah tersedia; pembaca buku native masih memerlukan endpoint konten yang dioptimalkan untuk mobile.
5. **Detail dan katalog PJJ siswa**: daftar sesi yang boleh diikuti sebelum meminta token LiveKit.
6. **Pagination konsisten**: beberapa endpoint mengembalikan seluruh data. Mobile membutuhkan `cursor`, `limit`, `hasMore`.
7. **Upload submission**: tugas siswa saat ini hanya menerima jawaban teks; belum ada kontrak lampiran mobile.
8. **Push notification**: endpoint registrasi/unregistrasi device token FCM/APNs dan preferensi notifikasi belum tersedia.
9. **Deep-link map**: `actionUrl` pemberitahuan masih memakai route web; perlu kontrak route mobile stabil.
10. **OpenAPI versioned**: buat `/openapi.json`, schema respons eksplisit, dan contract test agar perubahan web tidak merusak Flutter.

Rekomendasi arsitektur: pertahankan route web yang ada, lalu bangun facade `/api/mobile/v1` dengan bearer access token pendek, refresh token yang dapat dicabut, DTO khusus mobile, pagination cursor, dan compatibility policy. Jangan mengekspos Prisma model mentah sebagai kontrak publik jangka panjang.

## 17. Checklist implementasi Flutter

- Gunakan HTTPS saja.
- Simpan cookie/token dalam storage terenkripsi; bersihkan saat logout.
- Pisahkan cookie jar akun utama, orang tua, dan mitra.
- Lakukan bootstrap session setiap aplikasi dibuka.
- Jika mendapat `401`, hentikan request paralel, coba refresh/bootstrap sekali, lalu arahkan ke login.
- Jika mendapat `403`, sembunyikan fitur berdasarkan role tetapi tetap percayai keputusan server.
- Jangan mengirim retry otomatis untuk POST pembayaran, attempt ujian, payout, rewarded ad, atau submit final tanpa idempotency.
- Batasi retry GET dan gunakan exponential backoff.
- Validasi MIME dan ukuran sebelum upload, tetapi tetap tangani validasi server.
- Render PDF melalui viewer aman; validasi URL agar tetap pada host yang dipercaya.
- Jangan percaya skor, waktu ujian, saldo, status pembayaran, atau status kehadiran yang dihitung client.
- Tambahkan correlation/request ID ketika backend mobile versioned dibuat.

## 18. Sumber kebenaran

Dokumentasi ini diturunkan dari:

- `src/app/api/**/route.ts`
- `src/lib/auth.ts`
- `src/lib/api-role-guard.ts`
- `src/lib/notifications.ts`
- `src/lib/tka.ts`
- `src/lib/reading.ts`
- `prisma/schema.prisma`

Jika dokumentasi dan implementasi berbeda, implementasi server pada commit yang sedang dideploy adalah sumber kebenaran. Setiap perubahan kontrak API harus memperbarui dokumen ini dan menambah contract test.
