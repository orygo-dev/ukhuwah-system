# Modul Tugas GenPro

## Flow produksi

1. Guru membuka **Dashboard > Tugas**, memilih kelas dan mata pelajaran.
2. Guru memilih format **Jawaban uraian tunggal** atau **Paket soal terstruktur**.
3. Paket terstruktur mendukung pilihan tunggal, pilihan ganda kompleks, benar/salah, jawaban singkat, dan esai.
   Pertanyaan dan pilihan jawaban dapat memakai teks, gambar, atau keduanya.
4. Guru dapat menyimpan draft, meninjau detail, mengedit draft, lalu menerbitkannya.
   Jumlah soal dapat ditentukan di awal, bobot otomatis dibagi menjadi 100 poin, dan soal dapat diimpor melalui template XLSX/ZIP.
5. Saat diterbitkan, siswa kelas menerima notifikasi dan tugas tampil pada web serta aplikasi Android.
6. Siswa mengerjakan dan mengumpulkan sesuai kebijakan terlambat dan pengumpulan ulang.
7. Soal objektif dinilai otomatis. Esai dan nilai akhir dapat dinilai guru, disertai feedback per soal maupun keseluruhan.
8. Guru dapat mengembalikan tugas untuk revisi, memantau status seluruh siswa, melihat analisis per soal, dan mengekspor CSV.
   Tugas terbit dapat dikelola, ditutup/dibuka kembali, diduplikasi, atau diarsipkan tanpa menghapus jawaban.
9. Nilai tugas berstatus `GRADED` ikut dihitung dalam rekap nilai dan rapor semester.

## Kompatibilitas

- Seluruh tugas lama otomatis tetap bertipe `LEGACY_TEXT` dengan nilai maksimum 100.
- Jawaban dan nilai lama tidak dipindahkan, dihapus, atau ditulis ulang.
- Migration hanya menambah kolom/tabel dan mengisi `published_at` untuk tugas lama yang sudah terbit.
- Quiz Harian, Ujian, TKA, dan Penilaian manual tidak diubah.

## Konsistensi dan keamanan

- Struktur soal tidak dapat diubah setelah jawaban siswa masuk.
- Deadline disimpan sebagai waktu absolut dan ditampilkan dalam WIB. Tugas lama dimigrasikan ke pukul 23.59 WIB pada tanggal lamanya.
- Kunci jawaban tidak dikirim kepada siswa sebelum tugas dinilai.
- Submit siswa dan grading guru memakai version guard serta transaksi serializable.
- Klik ganda atau request yang bersamaan tidak dapat menimpa hasil yang lebih baru secara diam-diam.
- Tugas yang sudah memiliki jawaban diarsipkan, bukan dihapus secara fisik.
- Soal dan jawaban terkait dibersihkan melalui foreign key cascade bila draft tanpa jawaban benar-benar dihapus.
- Media soal hanya menerima JPG/PNG/WebP maksimal 5 MB, dibatasi per pemilik, dan hanya dihapus jika tidak lagi direferensikan soal lain.

## Deployment

Jalankan sebelum restart aplikasi:

```bash
npx prisma migrate deploy
npx prisma migrate status
npm run build
```

Migration: `202608310002_assignment_workflow` dan `202608310003_assignment_media_deadline`.
