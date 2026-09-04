/**
 * Struktur modul ajar lengkap setara kualitas seqolah.com
 * (berdasarkan referensi doc/ai-tools-modul-ajar.doc)
 */

export const SEQOLAH_QUALITY_RULES = `
STANDAR KUALITAS (WAJIB — setara platform profesional):
- Panjang dokumen: minimal 3.000 kata, ideal 4.000–6.000 kata. JANGAN ringkas.
- Setiap tabel HARUS terisi konkret — tidak boleh baris kosong atau "..." .
- Kegiatan pembelajaran: uraikan per pertemuan sesuai jumlah pertemuan input; setiap pertemuan punya tabel Aktivitas Guru | Aktivitas Siswa | Waktu.
- Gunakan sintaks model pembelajaran yang dipilih (PjBL/PBL/Cooperative Learning/dll.) secara eksplisit di kegiatan inti.
- Tujuan pembelajaran format ABCD (Audience, Behavior, Condition, Degree) dengan taksonomi Bloom (C1–C6/P1–P6).
- Sertakan LKPD 1 dan LKPD 2 yang bisa langsung dicetak (tabel dengan instruksi jelas).
- Sesuaikan contoh, kosakata, dan konteks dengan jenjang, kelas/fase, dan mata pelajaran.
- Untuk mapel bahasa asing: campurkan istilah asing relevan dalam aktivitas (seperti modul profesional).
- Hitung waktu pendahuluan ±15%, inti ±70%, penutup ±15% dari total alokasi waktu.
`.trim();

export const MODUL_AJAR_SEQOLAH_OUTLINE = `
# MODUL AJAR [MATA PELAJARAN]
## KURIKULUM MERDEKA — PENDEKATAN PEMBELAJARAN MENDALAM

---

## Bagian 1: Informasi Umum

### 1. Identitas Modul
Tabel Markdown | Komponen | Deskripsi | — isi dari data guru: Penyusun, Institusi, Tahun Ajaran, Jenjang, Kelas, Fase, Mata Pelajaran, Topik, Alokasi Waktu, Model Pembelajaran.

### 2. Kompetensi Awal
Paragraf pembuka + minimal 4 poin bullet konkret (pengetahuan/praktik sebelumnya yang diasumsikan).

### 3. Dimensi Profil Lulusan (DPL)
Tabel | Dimensi | Implementasi dalam Pembelajaran | — jabarkan SETIAP DPL yang dipilih guru dengan implementasi spesifik pada topik.

### 4. Sarana dan Prasarana
Tabel | Jenis | Rincian | — baris: Alat, Bahan, Media, Sumber Belajar (rinci dan kontekstual).

### 5. Target Peserta Didik
**Karakteristik umum:** (bullet minimal 3)
**Kebutuhan diferensiasi:** diferensiasi konten, proses, dan produk (masing-masing minimal 1 poin).

---

## Bagian 2: Komponen Inti

### 6. Capaian Pembelajaran (CP)
Fase/jenjang, elemen CP relevan, uraian capaian per elemen (Menyimak/Membaca/Menulis atau sesuai mapel).

### 7. Tujuan Pembelajaran (TP)
Format ABCD. Tabel | No | Tujuan Pembelajaran | — minimal 4 TP terukur (sebutkan level Bloom).

### 8. Alur Tujuan Pembelajaran (ATP)
Tabel | Pertemuan | Alur Kegiatan | TP yang Dicapai | — satu baris per pertemuan.

### 9. Pemahaman Bermakna
Paragraf + minimal 3 bullet (makna mendalam materi untuk kehidupan siswa).

### 10. Pertanyaan Pemantik
Minimal 3 pertanyaan bernomor yang memancing curiosity.

---

## Bagian 3: Kegiatan Pembelajaran

### 11. Pendahuluan (±15% alokasi waktu)
Tabel | Tahap | Aktivitas Guru | Aktivitas Siswa | Waktu |
Baris wajib: Salam & Doa, Presensi & Ice Breaking, Apersepsi, Motivasi, Penyampaian Tujuan — dengan menit spesifik.

### 12. Kegiatan Inti (±70% alokasi waktu)
Judul sintaks model pembelajaran yang dipilih.
Untuk SETIAP pertemuan: subjudul "Pertemuan N: [judul]" + tabel | Langkah Model | Aktivitas Guru | Aktivitas Siswa | Waktu |
Langkah model disesuaikan (mis. PjBL: orientasi, perencanaan, jadwal, monitoring, pengujian, evaluasi).
Akhiri dengan **Strategi Diferensiasi** (konten, proses, produk).

### 13. Penutup (±15% alokasi waktu)
Tabel | Tahap | Aktivitas Guru | Aktivitas Siswa | Waktu |
Baris: Refleksi, Asesmen Formatif, Tindak Lanjut, Doa & Salam.

---

## Bagian 4: Asesmen

### 14. Asesmen Diagnostik (Awal Pertemuan 1)
Tabel | No | Pertanyaan/Teknik | Tujuan | — minimal 3 baris.

### 15. Asesmen Formatif (Selama Proses)
Tabel | Aspek | Instrumen | Waktu | — minimal 5 baris.

### 16. Asesmen Sumatif
Instrumen produk/proyek. **Rubrik Penilaian** tabel | Kriteria | Skor 4 | Skor 3 | Skor 2 | Skor 1 | — minimal 5 kriteria.
**Konversi Nilai:** bullet skala A–D.

---

## Bagian 5: Lampiran

### 17. Pengayaan dan Remedial
**Kegiatan Pengayaan** (min 3 bullet) dan **Kegiatan Remedial** (min 3 bullet).

### 18. Refleksi Guru
Tabel | Aspek | Pertanyaan Refleksi | — minimal 6 aspek.

### 19. Lembar Kerja / Bahan Ajar
**LKPD 1:** judul, instruksi, tabel kerja siswa.
**LKPD 2:** bagian analisis + rencana proyek/tugas dengan tabel.

### 20. Glosarium
Tabel | Istilah | Arti | — minimal 8 istilah kunci topik.

### 21. Daftar Pustaka
Minimal 3 referensi (buku teks Kemendikbud + 2 sumber tambahan) format sitasi benar.

---

**Disusun oleh:** [Nama Guru], [Mata Pelajaran], [Sekolah], Tahun Ajaran [tahun]
`.trim();
