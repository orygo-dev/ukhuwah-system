export const LKPD_QUALITY_RULES = `
STANDAR KUALITAS LKPD (WAJIB):
- Judul utama harus "LEMBAR KERJA PESERTA DIDIK (LKPD)".
- Wajib ada bagian "HEADER LKPD" berupa tabel identitas minimal: Judul LKPD, Mata Pelajaran, Kelas/Semester, Fase, Nama Siswa, No. Absen, dan Tanggal.
- Wajib ada bagian "KOMPETENSI & TUJUAN PEMBELAJARAN" yang memuat:
  1. Capaian Pembelajaran (CP),
  2. Tujuan Pembelajaran (TP) dengan format ABCD atau setara yang operasional.
- Wajib ada "PETUNJUK PENGERJAAN" dalam bentuk poin-poin yang jelas.
- Wajib ada "RINGKASAN MATERI / DASAR TEORI" dengan subbagian konkret, bukan paragraf generik tunggal.
- Wajib ada "ALAT DAN BAHAN" dalam bentuk daftar atau tabel.
- Wajib ada "KEGIATAN PEMBELAJARAN" yang dibagi menjadi beberapa aktivitas/tahap dengan durasi.
- Wajib ada bagian "PERTANYAAN / TUGAS" dengan variasi bentuk tugas dan ruang jawaban/tabel jawaban yang jelas.
- Wajib ada "KESIMPULAN & REFLEKSI" yang memuat kesimpulan siswa dan refleksi diri.
- Wajib ada "RUBRIK PENILAIAN" yang memisahkan aspek tulisan/produk/praktik bila relevan serta menampilkan level penilaian yang konkret.
`.trim();

export const RUBRIK_QUALITY_RULES = `
STANDAR KUALITAS RUBRIK (WAJIB):
- Judul utama harus spesifik terhadap tugas atau performa yang dinilai.
- Wajib ada bagian "Identitas" berupa tabel yang memuat minimal: Mata Pelajaran, Jenjang, Jenis Asesmen, Teknik Penilaian, Tugas, Kurikulum, Kelas/Semester, dan Tahun Ajaran.
- Wajib ada bagian "Tabel Rubrik (4 Level)" dengan kolom 4 level pencapaian dan deskriptor konkret per kriteria.
- Wajib ada bagian "Pedoman Penskoran" yang menjelaskan bobot, rumus skor akhir, dan konversi nilai.
- Wajib ada "Lembar Penilaian" berupa tabel rekap yang siap dipakai guru.
- Wajib ada "Catatan Guru" sebagai area observasi kualitatif.
- Wajib ada bagian tindak lanjut berupa hal yang perlu diperhatikan, tips umpan balik, dan strategi tindak lanjut.
- Hindari deskriptor umum seperti "baik" tanpa indikator perilaku/hasil yang terukur.
`.trim();

export const LKPD_OUTLINE = `
# LEMBAR KERJA PESERTA DIDIK (LKPD)

## HEADER LKPD
Tabel identitas: Judul LKPD, Mata Pelajaran, Kelas/Semester, Fase, Nama Siswa, No. Absen, Tanggal.

## KOMPETENSI & TUJUAN PEMBELAJARAN
### Capaian Pembelajaran (CP)
### Tujuan Pembelajaran (TP) - Format ABCD

## PETUNJUK PENGERJAAN
Poin langkah kerja siswa.

## RINGKASAN MATERI / DASAR TEORI
Subbagian materi inti yang relevan dengan topik.

## ALAT DAN BAHAN
Daftar atau tabel alat/bahan.

## KEGIATAN PEMBELAJARAN
Tahap aktivitas dengan durasi.

## PERTANYAAN / TUGAS
Soal/tugas bervariasi dan ruang jawaban.

## KESIMPULAN & REFLEKSI
### Kesimpulan Siswa
### Refleksi Diri

## RUBRIK PENILAIAN
Subbagian rubrik tulisan/produk/praktik/jawaban jika relevan.
`.trim();

export const RUBRIK_OUTLINE = `
# Rubrik Penilaian: [Tugas/Topik] - [Mata Pelajaran]

## Identitas
Tabel komponen dan detail.

## Tabel Rubrik (4 Level)
Tabel kriteria dengan kolom level 4, 3, 2, 1.

## Pedoman Penskoran
Daftar bobot, rumus, dan konversi nilai.

## Lembar Penilaian
Tabel siap isi untuk guru.

## Catatan Guru
Poin area observasi.

## Hal yang Perlu Diperhatikan Saat Menilai
Poin panduan observasi.

## Tips Umpan Balik untuk Siswa
Poin umpan balik yang konstruktif.

## Strategi Tindak Lanjut
Poin pengayaan, remedial, dan tindak lanjut pembelajaran.
`.trim();
