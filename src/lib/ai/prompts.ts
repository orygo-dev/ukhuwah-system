import { DOCUMENT_OUTPUT_RULES } from "@/lib/document-format";
import {
  MODUL_AJAR_SEQOLAH_OUTLINE,
  SEQOLAH_QUALITY_RULES,
} from "@/lib/templates/seqolah-modul-ajar";
import {
  PROSEM_OUTLINE,
  PROSEM_QUALITY_RULES,
  PROTA_OUTLINE,
  PROTA_QUALITY_RULES,
} from "@/lib/templates/prota-prosem";
import {
  LKPD_OUTLINE,
  LKPD_QUALITY_RULES,
  RUBRIK_OUTLINE,
  RUBRIK_QUALITY_RULES,
} from "@/lib/templates/lkpd-rubrik";
import {
  SILABUS_OUTLINE,
  SILABUS_QUALITY_RULES,
} from "@/lib/templates/silabus";
import {
  BANK_SOAL_OUTLINE,
  BANK_SOAL_QUALITY_RULES,
} from "@/lib/templates/bank-soal";

export type GenerateInput = {
  toolSlug: string;
  data: Record<string, unknown>;
};

function docPrompt(body: string): string {
  return `${DOCUMENT_OUTPUT_RULES}\n\n${body}`;
}

export const TOOL_PROMPTS: Record<string, string> = {
  "modul-ajar": docPrompt(`Tugas: susun MODUL AJAR LENGKAP setara kualitas platform profesional (seqolah.com) untuk Kurikulum Merdeka — Pendekatan Pembelajaran Mendalam.

${SEQOLAH_QUALITY_RULES}

KETENTUAN ISI:
- Gunakan istilah "Dimensi Profil Lulusan (DPL)" pada Bagian 1 (bukan Profil Pelajar Pancasila), jabarkan tiap DPL yang dipilih guru.
- Jika "Capaian Pembelajaran" diisi, jadikan acuan utama; jika kosong, susun CP lengkap sesuai fase/jenjang/mapel.
- Jika "Tujuan Pembelajaran" kosong, susun minimal 4 TP format ABCD dengan level Bloom.
- Terapkan model pembelajaran yang dipilih (Praktik Pedagogis) dengan sintaks/langkah model yang benar di Kegiatan Inti.
- Jumlah pertemuan di ATP dan Kegiatan Inti = "Jumlah Pertemuan" dari input (default 1 jika tidak diisi).
- Alokasi waktu: pecah ke menit pada setiap tabel kegiatan; total konsisten dengan alokasi waktu input.
- Media/sumber belajar, kemitraan, lingkungan, dan digital: integrasikan ke Sarana Prasarana dan kegiatan jika diisi.
- Untuk mapel bahasa asing: sertakan istilah asing, instruksi bilingual pada LKPD jika relevan.

STRUKTUR WAJIB — ikuti kerangka 21 bagian berikut (gunakan heading Markdown persis):

${MODUL_AJAR_SEQOLAH_OUTLINE}

PENTING: Tulis SEMUA 21 bagian secara lengkap. Jangan berhenti di tengah. Jangan meringkas kegiatan inti.`),

  "bank-soal": docPrompt(`Tugas: susun BANK SOAL resmi berdasarkan input guru.

${BANK_SOAL_QUALITY_RULES}

Gunakan gaya dokumen evaluasi sekolah Indonesia yang siap pakai dan mudah dicetak.
Jika capaian/indikator tidak diisi guru, susun indikator yang relevan berdasarkan topik, mapel, jenjang, dan kelas.
Sesuaikan jumlah soal dengan input guru; jika kosong, default ke 5 pilihan ganda dan 2 esai.
Pilihan ganda harus memiliki satu jawaban paling tepat, pengecoh yang masuk akal, serta pembahasan singkat.
Esai harus menilai penalaran/uraian, bukan sekadar definisi tunggal, dan disertai rubrik singkat yang jelas.
Jika bentuk soal tambahan dipilih, tampilkan bagian khusus berikut instruksi dan kunci jawabannya.
Jangan menulis penjelasan di luar dokumen.

STRUKTUR WAJIB:

${BANK_SOAL_OUTLINE}`),

  "lkpd": docPrompt(`Tugas: susun LKPD (Lembar Kerja Peserta Didik) resmi.

${LKPD_QUALITY_RULES}

Gunakan bahasa Indonesia yang sesuai dengan jenjang peserta didik, tetapi tetap formal dan jelas.
Judul LKPD harus spesifik sesuai topik, bukan judul generik.
Jika guru tidak mengisi CP atau tujuan secara rinci, susun sendiri berdasarkan jenjang, kelas, mapel, dan topik.
Bagian tugas harus mengarah pada aktivitas siswa yang konkret: mengamati, menalar, menulis, mempraktikkan, atau menghasilkan produk.
Sediakan ruang jawaban berbentuk tabel, poin, atau placeholder garis agar siap dipakai sebagai lembar kerja.
Rubrik penilaian LKPD harus relevan dengan jenis tugas yang muncul di lembar kerja.
Jangan menulis penjelasan di luar dokumen.

STRUKTUR WAJIB:

${LKPD_OUTLINE}`),

  "jurnal-mengajar": docPrompt(`Tugas: susun JURNAL MENGAJAR harian resmi.

Struktur:
1. Identitas (tanggal, kelas, mapel, materi)
2. Tujuan pembelajaran
3. Kegiatan pembelajaran yang dilaksanakan
4. Evaluasi & hasil belajar siswa
5. Refleksi guru
6. Rencana tindak lanjut

Bahasa Indonesia formal. Format Markdown.`),

  "narasi-rapor": docPrompt(`Tugas: tulis NARASI RAPOR resmi yang humanis dan konstruktif.

Buat 3 versi (singkat, sedang, panjang) deskripsi capaian siswa berdasarkan input.
Hindari bahasa robot. Gunakan sapaan "Ananda [nama]".
Bahasa Indonesia baku pendidikan.`),

  "surat-dinas": docPrompt(`Tugas: susun SURAT DINAS resmi sesuai standar Kemendikdasmen.

Struktur:
- Kop surat (placeholder)
- Nomor, lampiran, perihal
- Pembuka, isi, penutup
- Tanda tangan

Bahasa Indonesia formal baku. Format Markdown.`),

  "rubrik": docPrompt(`Tugas: susun RUBRIK PENILAIAN resmi siap pakai.

${RUBRIK_QUALITY_RULES}

Tentukan 4-6 aspek/kriteria penilaian yang relevan dengan jenis penilaian dan topik. Jika guru sudah memberi daftar aspek, gunakan itu.
Gunakan 4 level pencapaian: "Sangat Baik (4)", "Baik (3)", "Cukup (2)", "Perlu Bimbingan (1)" dengan deskriptor yang teramati dan operasional.
Jika jenis penilaian berupa presentasi/praktik, deskriptor harus mencakup performa nyata seperti kelancaran, ketepatan, sikap, kepercayaan diri, atau kualitas produk.
Lembar penilaian harus siap dipakai guru untuk menilai beberapa siswa secara langsung.
Tambahkan tips umpan balik yang membangun dan strategi tindak lanjut yang realistis.
Jangan menulis penjelasan di luar dokumen.

STRUKTUR WAJIB:

${RUBRIK_OUTLINE}`),

  "silabus": docPrompt(`Tugas: susun SILABUS PEMBELAJARAN resmi siap pakai untuk satu semester.

${SILABUS_QUALITY_RULES}

Gunakan gaya dokumen sekolah Indonesia yang formal, siap cetak, dan rapi.
Jika CP tidak diisi guru, susun CP yang relevan berdasarkan jenjang, kelas, mapel, semester, dan kurikulum.
Jika ATP atau tujuan pembelajaran tidak diisi guru, susun alur satu semester yang realistis dan terdistribusi per minggu.
Gunakan istilah pembelajaran yang lazim di sekolah Indonesia: ATP, asesmen diagnostik, formatif, sumatif, sumber belajar, dan media.
Profil Pelajar Pancasila harus terhubung langsung dengan aktivitas pembelajaran, bukan hanya daftar nilai.
Asesmen wajib realistis dan menyebut waktu pelaksanaan serta bobot bila relevan.
Jangan menulis penjelasan di luar dokumen.

STRUKTUR WAJIB:

${SILABUS_OUTLINE}`),

  "prota": docPrompt(`Tugas: susun PROGRAM TAHUNAN (Prota) resmi.
 
${PROTA_QUALITY_RULES}

Gunakan gaya dokumen administrasi guru Indonesia yang siap cetak, rapi, dan formal.
Jika data sekolah/guru/NIP tersedia, wajib tampil di tabel identitas.
Jika CP tidak diisi guru, susun CP yang relevan dengan jenjang, kelas, mapel, dan kurikulum.
Gunakan istilah bulan Indonesia dan semester Ganjil/Genap.
Jika jenjang SMK/SMA dan kelas 10, Anda boleh membedakan CP fase E dan fase F bila membantu konteks tahunan.
Hindari placeholder kosong dan jangan menulis penjelasan di luar dokumen.

STRUKTUR WAJIB:

${PROTA_OUTLINE}`),

  "prosem": docPrompt(`Tugas: susun PROGRAM SEMESTER (Promes) resmi.

${PROSEM_QUALITY_RULES}

Gunakan gaya dokumen administrasi guru Indonesia yang siap pakai di sekolah.
Jika semester = Ganjil, gunakan rentang bulan Juli-Desember; jika semester = Genap, gunakan rentang Januari-Juni.
Jika CP tidak diisi guru, susun CP dan turunkan menjadi tujuan pembelajaran semester yang terukur.
Distribusi alokasi waktu harus realistis terhadap jumlah minggu efektif dan JP yang tersedia.
Jadwal asesmen harus mencakup formatif dan sumatif dengan bentuk asesmen yang konkret.
Bagian P5 harus relevan dengan jenjang/mapel dan boleh ditulis sebagai rencana kolaboratif lintas mapel.
Hindari placeholder dan jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:

${PROSEM_OUTLINE}`),

  atp: docPrompt(`Tugas: susun ATP / ALUR TUJUAN PEMBELAJARAN resmi dan siap dipakai guru.

Gunakan gaya dokumen kurikulum sekolah Indonesia yang rapi, terstruktur, dan siap cetak.
Jika CP tidak diisi guru, susun CP yang relevan berdasarkan jenjang, kelas/fase, mapel, semester, dan lingkup materi.
Turunkan CP menjadi rangkaian Tujuan Pembelajaran yang logis, bertahap dari mudah ke kompleks, dan realistis untuk jumlah pertemuan input.
Setiap TP wajib memuat materi inti, aktivitas pembelajaran, asesmen, alokasi waktu/JP, dan bukti belajar.
Jangan membuat ATP terlalu umum; gunakan istilah spesifik sesuai mapel dan topik.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas ATP
2. Rasional Singkat
3. Capaian Pembelajaran
4. Pemetaan Elemen / Domain Materi
5. Tabel Alur Tujuan Pembelajaran
6. Rencana Asesmen Diagnostik, Formatif, dan Sumatif
7. Diferensiasi dan Dukungan Pembelajaran
8. Media, Sumber Belajar, dan Produk Belajar
9. Catatan Implementasi Guru`),

  "bahan-ajar": docPrompt(`Tugas: susun BAHAN AJAR / MATERI AJAR resmi yang siap digunakan di kelas.

Gunakan bahasa yang sesuai jenjang, jelas, runtut, dan tidak terlalu akademik untuk siswa.
Jika tujuan pembelajaran kosong, susun sendiri tujuan yang operasional dan sesuai topik.
Bahan ajar harus memuat konsep inti, contoh kontekstual, latihan bertahap, rangkuman, glosarium bila relevan, dan refleksi belajar.
Jika media atau sumber belajar diisi, integrasikan ke kegiatan dan referensi.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Bahan Ajar
2. Tujuan Pembelajaran
3. Peta Konsep / Alur Materi
4. Materi Inti
5. Contoh dan Pembahasan
6. Aktivitas Belajar Siswa
7. Latihan Mandiri dan Kelompok
8. Rangkuman
9. Refleksi Siswa
10. Glosarium / Istilah Penting
11. Referensi dan Media Belajar`),

  "kisi-kisi-soal": docPrompt(`Tugas: susun KISI-KISI SOAL resmi dan siap cetak.

Gunakan format evaluasi sekolah Indonesia yang rapi, lengkap, dan mudah dipakai untuk menyusun soal.
Jika indikator tidak diisi guru, susun indikator yang relevan dan terukur dari CP/topik.
Tabel kisi-kisi wajib memuat nomor soal, CP/kompetensi, materi, indikator soal, level kognitif, bentuk soal, bobot/skor, dan kunci arah jawaban bila relevan.
Sebaran level kognitif harus proporsional terhadap input level guru.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Penilaian
2. Tujuan Penilaian
3. Ruang Lingkup Materi
4. Tabel Kisi-Kisi Soal
5. Distribusi Level Kognitif
6. Pedoman Penskoran Singkat
7. Catatan Penyusunan Soal`),

  "kartu-soal": docPrompt(`Tugas: susun KARTU SOAL resmi untuk setiap butir.

Gunakan format kartu soal sekolah Indonesia yang detail dan siap dipakai.
Setiap kartu wajib memuat identitas, kompetensi/CP, materi, indikator soal, level kognitif, bentuk soal, stimulus bila relevan, rumusan soal, opsi jawaban untuk PG, kunci jawaban, pembahasan, pedoman skor, dan catatan kualitas butir.
Jika jumlah kartu lebih dari satu, buat kartu lengkap satu per satu, bukan hanya daftar ringkas.
Pengecoh pilihan ganda harus masuk akal dan tidak asal.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Paket Kartu Soal
2. Ringkasan Spesifikasi Butir
3. Kartu Soal 1 dst.
4. Rekap Kunci Jawaban dan Skor
5. Catatan Validasi Butir`),

  "analisis-penilaian": docPrompt(`Tugas: susun ANALISIS HASIL PENILAIAN berdasarkan daftar nilai guru.

Gunakan format dokumen tindak lanjut penilaian yang profesional dan siap dicetak.
Hitung/petakan status tuntas dan belum tuntas berdasarkan KKM/KKTP input. Jika daftar nilai tidak bisa dihitung sempurna, tetap buat analisis kualitatif berdasarkan data yang tersedia.
Dokumen wajib memuat tabel nilai, status ketuntasan, ringkasan statistik sederhana, pemetaan materi yang perlu diperkuat, daftar remedial, daftar pengayaan, dan rencana tindak lanjut.
Jangan mengarang nama siswa di luar data input kecuali guru tidak memberi data; jika data kosong, tulis format tabel siap isi.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Analisis Penilaian
2. Kriteria Ketuntasan
3. Rekap Nilai dan Ketuntasan
4. Ringkasan Hasil Kelas
5. Analisis Capaian Materi
6. Program Remedial
7. Program Pengayaan
8. Tindak Lanjut Pembelajaran
9. Catatan Refleksi Guru`),

  "remedial-pengayaan": docPrompt(`Tugas: susun PROGRAM REMEDIAL DAN PENGAYAAN resmi.

Gunakan format administrasi guru yang siap pakai setelah penilaian.
Program remedial harus memuat diagnosis kesulitan, strategi belajar ulang, latihan bertahap, jadwal, asesmen ulang, dan kriteria keberhasilan.
Program pengayaan harus memuat tantangan lanjutan, proyek/produk, eksplorasi mandiri, dan indikator capaian tinggi.
Jika daftar siswa kosong, buat tabel siap isi tanpa mengarang nama.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Program
2. Dasar Pelaksanaan
3. Pemetaan Siswa Remedial dan Pengayaan
4. Rencana Kegiatan Remedial
5. Rencana Kegiatan Pengayaan
6. Jadwal Pelaksanaan
7. Instrumen Asesmen Ulang
8. Kriteria Keberhasilan
9. Catatan Tindak Lanjut`),

  "asesmen-diagnostik": docPrompt(`Tugas: susun ASESMEN DIAGNOSTIK awal pembelajaran.

Gunakan format instrumen diagnostik yang siap dipakai guru sebelum memulai topik.
Jika jenis diagnostik gabungan, buat bagian kognitif dan non-kognitif secara seimbang.
Instrumen kognitif harus memetakan prasyarat konsep, miskonsepsi, dan kesiapan belajar.
Instrumen non-kognitif harus memetakan minat, kebiasaan belajar, dukungan lingkungan, dan kesiapan emosi secara etis.
Sertakan pedoman interpretasi hasil dan rencana tindak lanjut pembelajaran.
Jangan menulis komentar di luar dokumen.

STRUKTUR WAJIB:
1. Identitas Asesmen Diagnostik
2. Tujuan Diagnostik
3. Kompetensi Prasyarat / Aspek yang Dipetakan
4. Instrumen Diagnostik Kognitif
5. Instrumen Diagnostik Non-kognitif
6. Pedoman Penskoran / Kategorisasi
7. Interpretasi Hasil
8. Rencana Tindak Lanjut
9. Lembar Rekap Guru`),
};

const FIELD_LABELS: Record<string, string> = {
  kurikulum: "Kurikulum",
  sekolah: "Nama Sekolah",
  namaGuru: "Nama Guru",
  jenjang: "Jenjang",
  kelas: "Kelas/Fase",
  mapel: "Mata Pelajaran",
  semester: "Semester",
  tahunAjaran: "Tahun Ajaran",
  alokasiWaktu: "Alokasi Waktu",
  topik: "Topik/Materi Pembelajaran",
  subtopik: "Subtopik",
  kesiapanPesertaDidik: "Identifikasi Peserta Didik",
  analisisMateri: "Analisis Materi",
  dimensiProfilLulusan: "Dimensi Profil Lulusan",
  capaianPembelajaran: "Capaian Pembelajaran",
  lintasDisiplin: "Lintas Disiplin Ilmu",
  tujuanPembelajaran: "Tujuan Pembelajaran",
  praktikPedagogis: "Praktik Pedagogis (Model)",
  kemitraan: "Kemitraan Pembelajaran",
  lingkungan: "Lingkungan Pembelajaran",
  pemanfaatanDigital: "Pemanfaatan Digital",
  modelPembelajaran: "Model Pembelajaran",
  media: "Media/Sumber Belajar",
  nip: "NIP",
  diferensiasi: "Diferensiasi",
  jumlahPertemuan: "Jumlah Pertemuan",
  metode: "Metode",
  jumlahPG: "Jumlah Soal Pilihan Ganda",
  jumlahEsai: "Jumlah Soal Esai",
  bentukSoal: "Bentuk Soal Tambahan",
  level: "Level Kognitif",
  indikator: "Indikator Soal",
  tujuan: "Tujuan",
  namaSiswa: "Nama Siswa",
  capaian: "Capaian / Catatan Perkembangan",
  tanggal: "Tanggal",
  materi: "Materi yang Diajarkan",
  kegiatan: "Ringkasan Kegiatan",
  kendala: "Kendala / Catatan",
  jenisPenilaian: "Jenis Penilaian",
  teknikPenilaian: "Teknik Penilaian",
  jenisAsesmen: "Jenis Asesmen",
  tugas: "Tugas/Performa yang Dinilai",
  aspek: "Aspek yang Dinilai",
  strategiAsesmen: "Strategi Asesmen",
  jenisSurat: "Jenis Surat",
  perihal: "Perihal",
  isi: "Poin Isi Surat",
  lingkupMateri: "Lingkup Materi / Unit",
  kedalamanMateri: "Kedalaman Materi",
  aktivitasLatihan: "Latihan yang Diinginkan",
  jumlahSoal: "Jumlah Soal",
  indikatorSoal: "Indikator Soal",
  levelKognitif: "Level Kognitif",
  jumlahButir: "Jumlah Kartu Soal",
  stimulus: "Stimulus",
  kkm: "KKM / KKTP",
  daftarNilai: "Daftar Nilai Siswa",
  catatan: "Catatan Tambahan",
  siswaRemedial: "Siswa Remedial",
  siswaPengayaan: "Siswa Pengayaan",
  bentukKegiatan: "Bentuk Kegiatan",
  jenisDiagnostik: "Jenis Diagnostik",
  jumlahPertanyaan: "Jumlah Pertanyaan",
  aspekNonKognitif: "Aspek Non-kognitif",
};

const JENJANG_LABELS: Record<string, string> = {
  sd: "SD/MI",
  smp: "SMP/MTs",
  sma: "SMA/MA",
  smk: "SMK/MAK",
};

const FASE_BY_JENJANG_KELAS: Record<string, Record<string, string>> = {
  sd: { "1": "A", "2": "A", "3": "B", "4": "B", "5": "C", "6": "C" },
  smp: { "7": "D", "8": "D", "9": "D" },
  sma: { "10": "E", "11": "E", "12": "E" },
  smk: { "10": "E-F", "11": "E-F", "12": "E-F" },
};

function inferFase(jenjang: string, kelas: string): string {
  return FASE_BY_JENJANG_KELAS[jenjang]?.[kelas] || "sesuai jenjang";
}

export function buildUserPrompt(toolSlug: string, data: Record<string, unknown>): string {
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] || k;
      let val = Array.isArray(v) ? v.join(", ") : String(v);
      if (val.includes("|")) val = val.split("|").filter(Boolean).join(", ");
      if (k === "jenjang") val = JENJANG_LABELS[val] || val;
      return `- ${label}: ${val}`;
    });

  const jenjang = String(data.jenjang || "");
  const kelas = String(data.kelas || "");
  const pertemuan = data.jumlahPertemuan || "1";
  const fase = inferFase(jenjang, kelas);

  if (toolSlug === "modul-ajar") {
    return `DATA INPUT GURU:

${lines.join("\n")}
- Fase (inferensi): ${fase}
- Jumlah pertemuan untuk ATP & kegiatan inti: ${pertemuan}

INSTRUKSI PENYUSUNAN:
1. Susun modul ajar LENGKAP 21 bagian — setara kualitas modul ajar profesional (seqolah.com).
2. Jangan meringkas; minimal 3.000 kata. Setiap tabel kegiatan wajib berisi aktivitas guru, aktivitas siswa, dan waktu (menit).
3. Kaitkan semua kegiatan dengan topik "${data.topik || "materi"}" dan model "${data.praktikPedagogis || data.modelPembelajaran || "pembelajaran"}". 
4. Field opsional yang kosong — AI wajib menyusun sendiri dengan konten spesifik (bukan placeholder).
5. Tulis langsung dokumen — tanpa komentar di luar dokumen.`;
  }

  return `DATA INPUT GURU:\n\n${lines.join("\n")}\n\nSusun dokumen administrasi lengkap berdasarkan data di atas. Tulis langsung isi dokumen resmi — tanpa sapaan atau penjelasan di luar dokumen.`;
}

export function getDocumentTitle(toolSlug: string, data: Record<string, unknown>): string {
  const topik = data.topik || data.topic || data.judul;
  const mapel = data.mapel || data.mataPelajaran || "";
  const names: Record<string, string> = {
    "modul-ajar": "Modul Ajar",
    atp: "ATP",
    "bahan-ajar": "Bahan Ajar",
    "bank-soal": "Bank Soal",
    "kisi-kisi-soal": "Kisi-Kisi Soal",
    "kartu-soal": "Kartu Soal",
    "analisis-penilaian": "Analisis Hasil Penilaian",
    "remedial-pengayaan": "Remedial & Pengayaan",
    "asesmen-diagnostik": "Asesmen Diagnostik",
    "lkpd": "LKPD",
    "jurnal-mengajar": "Jurnal Mengajar",
    "narasi-rapor": "Narasi Rapor",
    "surat-dinas": "Surat Dinas",
    "rubrik": "Rubrik Penilaian",
    "silabus": "Silabus",
    "prota": "Program Tahunan",
    "prosem": "Program Semester",
  };
  const prefix = names[toolSlug] || "Dokumen";
  if (topik) return `${prefix} — ${topik}${mapel ? ` (${mapel})` : ""}`;
  return `${prefix} — ${new Date().toLocaleDateString("id-ID")}`;
}
