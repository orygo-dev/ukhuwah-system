export const SILABUS_QUALITY_RULES = `
STANDAR KUALITAS SILABUS (WAJIB):
- Judul utama harus "Silabus Pembelajaran".
- Setelah judul utama, tampilkan subjudul mapel, kelas, dan semester.
- Wajib ada bagian "Identitas" berupa tabel minimal: Mata Pelajaran, Kelas / Semester, Fase, Tahun Ajaran, dan Alokasi Waktu.
- Wajib ada bagian "Capaian Pembelajaran (CP)" yang relevan dengan jenjang, kelas, mapel, dan kurikulum.
- Wajib ada bagian "Alur Tujuan Pembelajaran (ATP)" dalam tabel dengan kolom:
  Minggu | Tujuan Pembelajaran | Materi Pokok | Kegiatan Pembelajaran | Asesmen | Alokasi Waktu | Sumber Belajar.
- Baris ATP harus realistis untuk satu semester, bukan hanya 2-3 baris umum.
- Wajib ada bagian "Profil Pelajar Pancasila" dalam bentuk tabel dimensi, deskripsi, dan implementasi.
- Wajib ada bagian "Strategi & Rencana Asesmen" dalam bentuk tabel jenis asesmen, teknik, waktu pelaksanaan, dan bobot.
- Wajib ada bagian "Sumber Belajar dan Media" yang memisahkan buku teks, media/teknologi, dan sumber digital.
- Akhiri dengan "Catatan" yang menjelaskan fleksibilitas, pendekatan pembelajaran, atau penyesuaian kalender sekolah.
`.trim();

export const SILABUS_OUTLINE = `
# Silabus Pembelajaran
## [Mata Pelajaran] - Kelas [kelas] [semester]

### Identitas
Tabel komponen dan detail.

### Capaian Pembelajaran (CP)
Uraian CP semester.

### Alur Tujuan Pembelajaran (ATP)
Tabel:
| Minggu | Tujuan Pembelajaran | Materi Pokok | Kegiatan Pembelajaran | Asesmen | Alokasi Waktu | Sumber Belajar |

### Profil Pelajar Pancasila
Tabel:
| Dimensi | Deskripsi | Implementasi dalam Pembelajaran |

### Strategi & Rencana Asesmen
Tabel:
| Jenis Asesmen | Teknik | Waktu Pelaksanaan | Bobot |

### Sumber Belajar dan Media
Subbagian buku teks, media/teknologi, dan sumber digital.

### Catatan
Poin penyesuaian dan fleksibilitas pelaksanaan.
`.trim();
