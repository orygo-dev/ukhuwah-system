# Standar Mutu Soal TKA GenPro

Modul TKA GenPro adalah sarana simulasi dan latihan, bukan penyelenggara TKA resmi. Soal bawaan ditulis secara orisinal dengan mengacu pada prinsip umum kerangka TKA: kompetensi mata pelajaran, penerapan pengetahuan, penalaran, dan pemecahan masalah.

Referensi utama:

- Portal TKA Pusat Asesmen Pendidikan: https://pusmendik.kemendikdasmen.go.id/tka/
- Kerangka Asesmen TKA SMA/MA/SMK/MAK, Peraturan Kepala BSKAP Nomor 045/H/AN/2025.

## Quality gate

Sebelum soal dapat diajukan, disetujui, atau dipublikasikan, sistem memeriksa:

- 3–6 opsi yang terisi dan tidak duplikat;
- tepat satu kunci untuk pilihan tunggal;
- minimal dua kunci dan minimal satu pengecoh untuk pilihan ganda kompleks;
- kunci berada dalam rentang opsi;
- stimulus tidak mengulang pertanyaan;
- kompetensi ditulis secara spesifik;
- pembahasan menjelaskan proses memperoleh jawaban;
- peringatan untuk konteks yang terlalu pendek pada soal sedang/sulit;
- peringatan untuk opsi “semua/tidak ada jawaban di atas”.

Draf tetap dapat disimpan sebelum kompetensi dan pembahasan lengkap, tetapi tidak dapat masuk alur publikasi sampai seluruh persyaratan mutu terpenuhi.

## Paket bawaan

Paket demonstrasi lama yang hanya memiliki tiga soal diarsipkan oleh seed TKA. Penggantinya berisi 12 soal Matematika dengan muatan bilangan, aljabar, fungsi, geometri, data, peluang, trigonometri, barisan, pertumbuhan eksponensial, dan optimasi.

Validasi tanpa mengubah database:

```bash
npx tsx scripts/seed-tka.ts --validate-only
```

Penerapan paket ke database:

```bash
npm run db:seed:tka
```
