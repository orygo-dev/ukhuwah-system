export const BANK_SOAL_QUALITY_RULES = `
STANDAR KUALITAS BANK SOAL (WAJIB):
- Judul utama harus "Bank Soal".
- Wajib ada tabel identitas minimal: Mata Pelajaran, Jenjang, Kelas/Semester, Kurikulum, Tahun Ajaran, Topik, dan Penyusun jika tersedia.
- Wajib ada bagian "Kisi-Kisi Soal" dalam tabel dengan kolom minimal:
  No | Indikator Soal | Bentuk Soal | Level Kognitif | Nomor Soal.
- Wajib ada bagian "Soal Pilihan Ganda" sesuai jumlah yang diminta, lengkap dengan opsi A-D, kunci jawaban, dan pembahasan singkat.
- Wajib ada bagian "Soal Uraian / Esai" sesuai jumlah yang diminta, lengkap dengan kunci/rambu jawaban dan rubrik penilaian.
- Jika ada bentuk soal tambahan, tampilkan dalam bagian tersendiri dengan instruksi dan kunci jawaban.
- Wajib ada bagian "Distribusi Level Kognitif" dalam tabel yang merangkum LOTS/HOTS atau campurannya.
- Soal harus relevan dengan topik, jenjang, kelas, dan mapel; hindari soal terlalu umum atau tidak operasional.
- Bahasa harus formal, jelas, dan sesuai konteks evaluasi sekolah Indonesia.
`.trim();

export const BANK_SOAL_OUTLINE = `
# Bank Soal

## Identitas
Tabel komponen dan detail.

## Kisi-Kisi Soal
Tabel:
| No | Indikator Soal | Bentuk Soal | Level Kognitif | Nomor Soal |

## Soal Pilihan Ganda
Setiap soal memuat stem, opsi A-D, kunci jawaban, dan pembahasan.

## Soal Uraian / Esai
Setiap soal memuat pertanyaan, rambu jawaban, dan rubrik singkat.

## Bentuk Soal Tambahan
Bagian ini hanya muncul jika diminta.

## Distribusi Level Kognitif
Tabel ringkasan LOTS/HOTS dan jumlah soal.
`.trim();
