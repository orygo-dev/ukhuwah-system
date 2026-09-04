export const PROTA_QUALITY_RULES = `
STANDAR KUALITAS PROTA (WAJIB):
- Judul utama harus "Program Tahunan (Prota)".
- Awali dengan tabel Identitas berisi minimal: Satuan Pendidikan, Mata Pelajaran, Kelas, Fase, Tahun Ajaran, Guru Pengampu, dan NIP jika tersedia.
- Tulis bagian "Capaian Pembelajaran (CP)" yang relevan dengan jenjang/fase; jika jenjang SMA/SMK dan kelas 10, bedakan CP fase E dan fase F bila relevan.
- Wajib ada dua bagian analisis alokasi waktu: Semester 1 (Ganjil) dan Semester 2 (Genap).
- Setiap analisis semester wajib memuat:
  1. tabel Bulan | Minggu Efektif | Keterangan,
  2. ringkasan rincian JP (contoh: 1 JP = 45 menit, alokasi x JP per minggu),
  3. tabel Bulan | JP per Bulan,
  4. total minggu efektif dan total JP.
- Wajib ada dua tabel program tahunan: Semester 1 (Ganjil) dan Semester 2 (Genap).
- Tabel program tahunan wajib berisi kolom: No | Tujuan Pembelajaran | Materi Pokok | Alokasi Waktu (JP) | Bulan Pelaksanaan | Keterangan.
- Keterangan pada tabel prota harus konkret, misalnya integrasi deep learning, diferensiasi, atau konteks dunia nyata.
- Akhiri dengan bagian "Catatan dan Rekomendasi" berupa poin-poin implementatif, bukan placeholder.
`.trim();

export const PROSEM_QUALITY_RULES = `
STANDAR KUALITAS PROSEM (WAJIB):
- Judul utama harus "Program Semester (Prosem)".
- Awali dengan tabel Identitas berisi minimal: Mata Pelajaran, Kelas / Semester, Fase, Tahun Ajaran, Nama Sekolah, Nama Guru, dan NIP jika tersedia.
- Tulis bagian "Capaian Pembelajaran (CP)" diikuti rincian CP spesifik semester terpilih.
- Wajib ada bagian "Analisis Minggu Efektif" untuk semester terpilih dengan tabel:
  No | Bulan | Jumlah Minggu | Minggu Tidak Efektif | Minggu Efektif | Keterangan.
- Setelah analisis minggu efektif, tulis ringkasan total minggu efektif dan total JP tersedia.
- Wajib ada bagian "Distribusi Alokasi Waktu" dengan tabel kolom bulan singkat (mis. Jul, Agu, Sep, dst.), kolom JP, dan kolom keterangan.
- Baris distribusi harus berbasis Tujuan Pembelajaran (TP), bukan sekadar materi umum.
- Wajib ada bagian "Jadwal Asesmen" dengan tabel: No | Jenis | Materi/TP | Minggu | Bulan | Bentuk.
- Wajib ada bagian "Rencana Kegiatan P5" dengan tabel: Tema P5 | Dimensi | Alokasi | Bulan | Keterangan.
- Tambahkan catatan penutup singkat terkait fleksibilitas pelaksanaan, integrasi asesmen, dan sinkronisasi dengan kalender sekolah.
`.trim();

export const PROTA_OUTLINE = `
# Program Tahunan (Prota)

## Identitas
Tabel Markdown | Komponen | Detail | berisi Satuan Pendidikan, Mata Pelajaran, Kelas, Fase, Tahun Ajaran, Guru Pengampu, dan NIP.

## Capaian Pembelajaran (CP)
Uraian CP yang relevan dengan fase/jenjang, boleh dipisahkan per fase jika diperlukan.

## Analisis Alokasi Waktu - Semester 1 (Ganjil)
Tabel | Bulan | Minggu Efektif | Keterangan |
Paragraf ringkas rincian JP per minggu.
Tabel | Bulan | JP per Bulan |

## Analisis Alokasi Waktu - Semester 2 (Genap)
Tabel | Bulan | Minggu Efektif | Keterangan |
Paragraf ringkas rincian JP per minggu.
Tabel | Bulan | JP per Bulan |

## Program Tahunan - Semester 1 (Ganjil)
Tabel | No | Tujuan Pembelajaran | Materi Pokok | Alokasi Waktu (JP) | Bulan Pelaksanaan | Keterangan |

## Program Tahunan - Semester 2 (Genap)
Tabel | No | Tujuan Pembelajaran | Materi Pokok | Alokasi Waktu (JP) | Bulan Pelaksanaan | Keterangan |

## Catatan dan Rekomendasi
Poin implementatif yang relevan dengan pembelajaran Indonesia.
`.trim();

export const PROSEM_OUTLINE = `
# Program Semester (Prosem)

## Identitas
Tabel Markdown | Komponen | Detail | berisi Mata Pelajaran, Kelas / Semester, Fase, Tahun Ajaran, Nama Sekolah, Nama Guru, dan NIP.

## Capaian Pembelajaran (CP)
Paragraf CP umum + daftar CP spesifik semester.

## Analisis Minggu Efektif
Tabel | No | Bulan | Jumlah Minggu | Minggu Tidak Efektif | Minggu Efektif | Keterangan |
Ringkasan total minggu efektif dan total JP tersedia.

## Distribusi Alokasi Waktu
Tabel | No | Tujuan Pembelajaran | JP | [bulan singkat semester] | Ket |

## Jadwal Asesmen
Tabel | No | Jenis | Materi/TP | Minggu | Bulan | Bentuk |

## Rencana Kegiatan P5
Tabel | Tema P5 | Dimensi | Alokasi | Bulan | Keterangan |

## Catatan
Poin singkat terkait pelaksanaan, asesmen, dan fleksibilitas kalender sekolah.
`.trim();
