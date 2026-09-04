export type FormField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "number" | "checkbox";
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Dynamic option source resolved from curriculum data (e.g. "kelas", "mapel"). */
  optionsSource?: "kelas" | "mapel" | "model" | "alokasi" | "dpl" | "semester";
  /** Field name whose value this field depends on; cleared when parent changes. */
  dependsOn?: string;
  helperText?: string;
  required?: boolean;
  colSpan?: 1 | 2;
};

export type ToolFormStep = {
  id: string;
  label: string;
  fields: FormField[];
};

const FIELD_JENJANG: FormField = {
  name: "jenjang",
  label: "Jenjang",
  type: "select",
  required: true,
  options: [
    { value: "sd", label: "SD / MI" },
    { value: "smp", label: "SMP / MTs" },
    { value: "sma", label: "SMA / MA" },
    { value: "smk", label: "SMK / MAK" },
  ],
};

const FIELD_KELAS: FormField = {
  name: "kelas",
  label: "Kelas / Fase",
  type: "select",
  required: true,
  optionsSource: "kelas",
  dependsOn: "jenjang",
  helperText: "Pilih jenjang terlebih dahulu",
};

const FIELD_MAPEL: FormField = {
  name: "mapel",
  label: "Mata Pelajaran",
  type: "select",
  required: true,
  optionsSource: "mapel",
  dependsOn: "jenjang",
  helperText: "Pilih jenjang terlebih dahulu",
};

/** Common identity fields (jenjang → kelas → mapel cascading). */
const IDENTITAS_FIELDS: FormField[] = [FIELD_JENJANG, FIELD_KELAS, FIELD_MAPEL];

export const TOOL_FORMS: Record<string, ToolFormStep[]> = {
  "modul-ajar": [
    {
      id: "identitas",
      label: "Identitas",
      fields: [
        { name: "sekolah", label: "Nama Sekolah", type: "text", required: true, placeholder: "SMP Negeri 1 ..." },
        { name: "namaGuru", label: "Nama Guru", type: "text", required: true, placeholder: "Nama lengkap guru" },
        { ...FIELD_JENJANG },
        { ...FIELD_KELAS },
        { ...FIELD_MAPEL },
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        {
          name: "alokasiWaktu",
          label: "Alokasi Waktu",
          type: "select",
          required: true,
          optionsSource: "alokasi",
        },
        {
          name: "jumlahPertemuan",
          label: "Jumlah Pertemuan",
          type: "number",
          required: true,
          placeholder: "1",
        },
      ],
    },
    {
      id: "identifikasi",
      label: "Identifikasi",
      fields: [
        {
          name: "topik",
          label: "Topik / Materi Pembelajaran",
          type: "text",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: Sistem Persamaan Linear Dua Variabel",
        },
        {
          name: "kesiapanPesertaDidik",
          label: "Identifikasi Peserta Didik (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kesiapan belajar: pengetahuan awal, minat, latar belakang, kebutuhan. Kosongkan agar AI menyusun.",
        },
        {
          name: "analisisMateri",
          label: "Analisis Materi (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Jenis pengetahuan, relevansi, tingkat kesulitan, integrasi nilai/karakter. Kosongkan agar AI menyusun.",
        },
        {
          name: "dimensiProfilLulusan",
          label: "Dimensi Profil Lulusan (pilih yang relevan)",
          type: "checkbox",
          required: true,
          optionsSource: "dpl",
          colSpan: 2,
        },
      ],
    },
    {
      id: "desain",
      label: "Desain Pembelajaran",
      fields: [
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran (sesuai fase)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Salin CP dari ATP/dokumen kurikulum. Kosongkan agar AI menyusun sesuai fase.",
        },
        {
          name: "tujuanPembelajaran",
          label: "Tujuan Pembelajaran (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menurunkan dari CP (kata kerja operasional, per pertemuan).",
        },
        {
          name: "praktikPedagogis",
          label: "Praktik Pedagogis (Model Pembelajaran)",
          type: "select",
          required: true,
          optionsSource: "model",
          colSpan: 2,
        },
        { name: "lintasDisiplin", label: "Lintas Disiplin Ilmu (opsional)", type: "text", colSpan: 2, placeholder: "Mapel/disiplin lain yang relevan" },
        { name: "kemitraan", label: "Kemitraan Pembelajaran (opsional)", type: "text", placeholder: "Orang tua, komunitas, DUDI, ..." },
        { name: "lingkungan", label: "Lingkungan Pembelajaran (opsional)", type: "text", placeholder: "Kelas, lab, LMS, lingkungan luar" },
        { name: "pemanfaatanDigital", label: "Pemanfaatan Digital (opsional)", type: "text", colSpan: 2, placeholder: "Perpustakaan digital, forum daring, asesmen daring" },
        { name: "media", label: "Media / Sumber Belajar (opsional)", type: "text", colSpan: 2, placeholder: "Slide, LKPD, video, alat peraga" },
      ],
    },
  ],
  "bank-soal": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
        },
        { name: "topik", label: "Topik / Materi", type: "text", required: true, colSpan: 2 },
        {
          name: "capaianPembelajaran",
          label: "Capaian / Indikator (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun indikator dari topik.",
        },
        {
          name: "indikator",
          label: "Indikator Soal (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Pisahkan dengan baris baru atau koma. Kosongkan agar AI menyusun kisi-kisi.",
        },
      ],
    },
    {
      id: "spesifikasi",
      label: "Spesifikasi",
      fields: [
        { name: "jumlahPG", label: "Jumlah Soal PG", type: "number", required: true, placeholder: "5" },
        { name: "jumlahEsai", label: "Jumlah Soal Esai", type: "number", required: true, placeholder: "2" },
        {
          name: "bentukSoal",
          label: "Bentuk Soal Tambahan",
          type: "select",
          required: true,
          options: [
            { value: "Tidak ada", label: "Tidak ada" },
            { value: "Isian Singkat", label: "Isian Singkat" },
            { value: "Benar/Salah", label: "Benar/Salah" },
            { value: "Menjodohkan", label: "Menjodohkan" },
          ],
        },
        {
          name: "level",
          label: "Level Kognitif",
          type: "select",
          required: true,
          options: [
            { value: "LOTS (C1-C3)", label: "LOTS (C1-C3)" },
            { value: "HOTS (C4-C6)", label: "HOTS (C4-C6)" },
            { value: "Campuran LOTS & HOTS", label: "Campuran LOTS & HOTS" },
          ],
        },
      ],
    },
  ],
  atp: [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        {
          name: "alokasiWaktu",
          label: "Alokasi Waktu Semester",
          type: "text",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: 72 JP / semester",
        },
      ],
    },
    {
      id: "alur",
      label: "Alur Pembelajaran",
      fields: [
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran",
          type: "textarea",
          colSpan: 2,
          placeholder: "Salin CP dari dokumen kurikulum. Kosongkan agar AI menyusun sesuai fase.",
        },
        {
          name: "lingkupMateri",
          label: "Lingkup Materi / Unit",
          type: "textarea",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: Bilangan bulat, pecahan, perbandingan, aljabar.",
        },
        {
          name: "jumlahPertemuan",
          label: "Jumlah Pertemuan",
          type: "number",
          required: true,
          placeholder: "16",
        },
        {
          name: "strategiAsesmen",
          label: "Strategi Asesmen (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: diagnostik awal, formatif per unit, sumatif akhir lingkup materi.",
        },
      ],
    },
  ],
  "bahan-ajar": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Topik / Materi", type: "text", required: true, colSpan: 2 },
      ],
    },
    {
      id: "materi",
      label: "Materi",
      fields: [
        {
          name: "tujuanPembelajaran",
          label: "Tujuan Pembelajaran",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun tujuan yang sesuai topik.",
        },
        {
          name: "kedalamanMateri",
          label: "Kedalaman Materi",
          type: "select",
          required: true,
          options: [
            { value: "Ringkas untuk pengantar", label: "Ringkas untuk pengantar" },
            { value: "Standar untuk kegiatan kelas", label: "Standar untuk kegiatan kelas" },
            { value: "Mendalam dengan contoh dan latihan", label: "Mendalam dengan contoh dan latihan" },
          ],
        },
        {
          name: "media",
          label: "Media / Sumber Belajar (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: buku teks, video, artikel, gambar, alat peraga.",
        },
        {
          name: "aktivitasLatihan",
          label: "Latihan yang Diinginkan (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: latihan pilihan ganda, esai singkat, studi kasus, tugas proyek mini.",
        },
      ],
    },
  ],
  "kisi-kisi-soal": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Topik / Materi", type: "text", required: true, colSpan: 2 },
        {
          name: "capaianPembelajaran",
          label: "Capaian / Kompetensi (opsional)",
          type: "textarea",
          colSpan: 2,
        },
      ],
    },
    {
      id: "spesifikasi",
      label: "Spesifikasi Soal",
      fields: [
        { name: "jumlahSoal", label: "Jumlah Soal", type: "number", required: true, placeholder: "20" },
        {
          name: "bentukSoal",
          label: "Bentuk Soal",
          type: "select",
          required: true,
          options: [
            { value: "Pilihan Ganda", label: "Pilihan Ganda" },
            { value: "Esai", label: "Esai" },
            { value: "Campuran", label: "Campuran" },
            { value: "Isian Singkat", label: "Isian Singkat" },
          ],
        },
        {
          name: "level",
          label: "Level Kognitif",
          type: "select",
          required: true,
          options: [
            { value: "Campuran C1-C6", label: "Campuran C1-C6" },
            { value: "LOTS (C1-C3)", label: "LOTS (C1-C3)" },
            { value: "HOTS (C4-C6)", label: "HOTS (C4-C6)" },
          ],
        },
        {
          name: "indikator",
          label: "Indikator Soal (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Pisahkan per baris. Kosongkan agar AI menyusun indikator.",
        },
      ],
    },
  ],
  "kartu-soal": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Topik / Materi", type: "text", required: true, colSpan: 2 },
      ],
    },
    {
      id: "butir",
      label: "Butir Soal",
      fields: [
        {
          name: "indikatorSoal",
          label: "Indikator Soal",
          type: "textarea",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: Disajikan data, siswa mampu menentukan ...",
        },
        {
          name: "bentukSoal",
          label: "Bentuk Soal",
          type: "select",
          required: true,
          options: [
            { value: "Pilihan Ganda", label: "Pilihan Ganda" },
            { value: "Esai", label: "Esai" },
            { value: "Isian Singkat", label: "Isian Singkat" },
          ],
        },
        {
          name: "levelKognitif",
          label: "Level Kognitif",
          type: "select",
          required: true,
          options: [
            { value: "C1 Mengingat", label: "C1 Mengingat" },
            { value: "C2 Memahami", label: "C2 Memahami" },
            { value: "C3 Menerapkan", label: "C3 Menerapkan" },
            { value: "C4 Menganalisis", label: "C4 Menganalisis" },
            { value: "C5 Mengevaluasi", label: "C5 Mengevaluasi" },
            { value: "C6 Mencipta", label: "C6 Mencipta" },
          ],
        },
        { name: "jumlahButir", label: "Jumlah Kartu Soal", type: "number", required: true, placeholder: "5" },
        {
          name: "stimulus",
          label: "Stimulus / Bacaan / Data (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Masukkan stimulus jika ingin digunakan pada soal.",
        },
      ],
    },
  ],
  "analisis-penilaian": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Materi / Penilaian", type: "text", required: true, colSpan: 2 },
      ],
    },
    {
      id: "nilai",
      label: "Data Nilai",
      fields: [
        {
          name: "jenisPenilaian",
          label: "Jenis Penilaian",
          type: "select",
          required: true,
          options: [
            { value: "Formatif", label: "Formatif" },
            { value: "Sumatif", label: "Sumatif" },
            { value: "Praktik", label: "Praktik" },
            { value: "Proyek", label: "Proyek" },
          ],
        },
        { name: "kkm", label: "KKM / KKTP", type: "number", required: true, placeholder: "75" },
        {
          name: "daftarNilai",
          label: "Daftar Nilai Siswa",
          type: "textarea",
          required: true,
          colSpan: 2,
          placeholder: "Format: Nama Siswa - Nilai. Contoh:\nAlya - 86\nBima - 72\nCitra - 91",
        },
        {
          name: "catatan",
          label: "Catatan Tambahan (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: beberapa siswa belum menguasai konsep dasar pecahan.",
        },
      ],
    },
  ],
  "remedial-pengayaan": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Materi / Kompetensi", type: "text", required: true, colSpan: 2 },
        {
          name: "tujuanPembelajaran",
          label: "Tujuan Pembelajaran",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun tujuan sesuai materi.",
        },
      ],
    },
    {
      id: "program",
      label: "Program",
      fields: [
        { name: "kkm", label: "KKM / KKTP", type: "number", required: true, placeholder: "75" },
        {
          name: "siswaRemedial",
          label: "Siswa Remedial",
          type: "textarea",
          colSpan: 2,
          placeholder: "Nama siswa atau kelompok yang belum tuntas. Kosongkan jika belum ada data.",
        },
        {
          name: "siswaPengayaan",
          label: "Siswa Pengayaan",
          type: "textarea",
          colSpan: 2,
          placeholder: "Nama siswa atau kelompok tuntas tinggi. Kosongkan jika belum ada data.",
        },
        {
          name: "bentukKegiatan",
          label: "Bentuk Kegiatan yang Diinginkan (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: tutor sebaya, latihan bertahap, proyek mini, kuis ulang.",
        },
      ],
    },
  ],
  "asesmen-diagnostik": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        { name: "tahunAjaran", label: "Tahun Ajaran", type: "text", required: true, placeholder: "2025/2026" },
        { name: "topik", label: "Topik Awal Pembelajaran", type: "text", required: true, colSpan: 2 },
      ],
    },
    {
      id: "instrumen",
      label: "Instrumen",
      fields: [
        {
          name: "jenisDiagnostik",
          label: "Jenis Diagnostik",
          type: "select",
          required: true,
          options: [
            { value: "Kognitif", label: "Kognitif" },
            { value: "Non-kognitif", label: "Non-kognitif" },
            { value: "Gabungan kognitif dan non-kognitif", label: "Gabungan" },
          ],
        },
        { name: "jumlahPertanyaan", label: "Jumlah Pertanyaan", type: "number", required: true, placeholder: "10" },
        {
          name: "tujuanPembelajaran",
          label: "Tujuan / Kompetensi Awal",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun kompetensi prasyarat.",
        },
        {
          name: "aspekNonKognitif",
          label: "Aspek Non-kognitif (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: minat belajar, dukungan rumah, gaya belajar, kesiapan emosi.",
        },
      ],
    },
  ],
  "lkpd": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
        },
        { name: "topik", label: "Topik", type: "text", required: true, colSpan: 2 },
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun CP sesuai jenjang, kelas, mapel, dan topik.",
        },
        {
          name: "modelPembelajaran",
          label: "Model Pembelajaran",
          type: "select",
          optionsSource: "model",
          colSpan: 2,
        },
        {
          name: "tujuan",
          label: "Tujuan Kegiatan / TP",
          type: "textarea",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: Siswa mampu memperkenalkan diri secara lisan dan tulis dengan struktur yang tepat.",
        },
        {
          name: "media",
          label: "Media / Alat dan Bahan (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: LKPD cetak, kamus mini, kartu kosakata, gawai, speaker.",
        },
      ],
    },
  ],
  "jurnal-mengajar": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "tanggal", label: "Tanggal", type: "text", placeholder: "29 Juni 2026" },
        ...IDENTITAS_FIELDS,
        { name: "materi", label: "Materi yang Diajarkan", type: "text", required: true, colSpan: 2 },
        { name: "kegiatan", label: "Ringkasan Kegiatan", type: "textarea", colSpan: 2 },
        {
          name: "kendala",
          label: "Kendala / Catatan (opsional)",
          type: "textarea",
          colSpan: 2,
        },
      ],
    },
  ],
  "narasi-rapor": [
    {
      id: "konteks",
      label: "Data Siswa",
      fields: [
        { name: "namaSiswa", label: "Nama Siswa", type: "text", required: true },
        FIELD_JENJANG,
        FIELD_KELAS,
        FIELD_MAPEL,
        {
          name: "capaian",
          label: "Capaian / Catatan Perkembangan",
          type: "textarea",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: sangat baik dalam kerja kelompok, perlu peningkatan ketelitian berhitung.",
        },
      ],
    },
  ],
  "rubrik": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
        },
        { name: "topik", label: "Topik / Tugas yang Dinilai", type: "text", required: true, colSpan: 2 },
        {
          name: "jenisPenilaian",
          label: "Jenis Penilaian",
          type: "select",
          required: true,
          colSpan: 2,
          options: [
            { value: "Proyek", label: "Proyek" },
            { value: "Presentasi", label: "Presentasi" },
            { value: "Praktik / Kinerja", label: "Praktik / Kinerja" },
            { value: "Produk", label: "Produk" },
            { value: "Portofolio", label: "Portofolio" },
            { value: "Tertulis (Esai)", label: "Tertulis (Esai)" },
          ],
        },
        {
          name: "jenisAsesmen",
          label: "Jenis Asesmen",
          type: "select",
          required: true,
          colSpan: 2,
          options: [
            { value: "Asesmen Formatif", label: "Asesmen Formatif" },
            { value: "Asesmen Sumatif", label: "Asesmen Sumatif" },
            { value: "Diagnostik", label: "Diagnostik" },
          ],
        },
        {
          name: "teknikPenilaian",
          label: "Teknik Penilaian",
          type: "text",
          colSpan: 2,
          placeholder: "Contoh: Kinerja / Praktik, Observasi, Portofolio",
        },
        {
          name: "aspek",
          label: "Aspek yang Dinilai (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Pisahkan dengan koma. Kosongkan agar AI menentukan aspek yang relevan.",
        },
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          colSpan: 2,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
      ],
    },
  ],
  "silabus": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah (opsional)", type: "text", colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru (opsional)", type: "text", colSpan: 2 },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          optionsSource: "semester",
        },
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
        },
        {
          name: "alokasiWaktu",
          label: "Alokasi Waktu Semester",
          type: "text",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: 72 JP / semester",
        },
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun CP sesuai mapel, fase, dan semester.",
        },
        {
          name: "tujuanPembelajaran",
          label: "Tujuan Pembelajaran / ATP (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun ATP satu semester lengkap.",
        },
        {
          name: "dimensiProfilLulusan",
          label: "Profil Pelajar Pancasila / DPL",
          type: "checkbox",
          optionsSource: "dpl",
          colSpan: 2,
        },
        {
          name: "strategiAsesmen",
          label: "Strategi Asesmen (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: diagnostik di awal, formatif per unit, sumatif tengah dan akhir semester.",
        },
        {
          name: "media",
          label: "Sumber Belajar dan Media (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Contoh: buku teks, video, LMS, proyektor, LKPD, platform digital.",
        },
      ],
    },
  ],
  "prota": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah", type: "text", required: true, colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru", type: "text", required: true },
        { name: "nip", label: "NIP (opsional)", type: "text" },
        ...IDENTITAS_FIELDS,
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
          colSpan: 2,
        },
        {
          name: "alokasiWaktu",
          label: "Alokasi Waktu per Minggu",
          type: "text",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: 3 JP per minggu (1 JP = 45 menit)",
        },
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran / Daftar Materi (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun CP dan distribusi tujuan pembelajaran 1 tahun sesuai fase.",
        },
      ],
    },
  ],
  "prosem": [
    {
      id: "konteks",
      label: "Konteks",
      fields: [
        {
          name: "kurikulum",
          label: "Kurikulum",
          type: "select",
          required: true,
          options: [
            { value: "Kurikulum Merdeka", label: "Kurikulum Merdeka" },
            { value: "Kurikulum 2013", label: "Kurikulum 2013" },
          ],
        },
        { name: "sekolah", label: "Nama Sekolah", type: "text", required: true, colSpan: 2 },
        { name: "namaGuru", label: "Nama Guru", type: "text", required: true },
        { name: "nip", label: "NIP (opsional)", type: "text" },
        ...IDENTITAS_FIELDS,
        {
          name: "semester",
          label: "Semester",
          type: "select",
          required: true,
          options: [
            { value: "Ganjil", label: "Ganjil" },
            { value: "Genap", label: "Genap" },
          ],
        },
        {
          name: "tahunAjaran",
          label: "Tahun Ajaran",
          type: "text",
          required: true,
          placeholder: "2025/2026",
        },
        {
          name: "alokasiWaktu",
          label: "Alokasi Waktu per Minggu",
          type: "text",
          required: true,
          colSpan: 2,
          placeholder: "Contoh: 2 JP per minggu (1 JP = 45 menit)",
        },
        {
          name: "capaianPembelajaran",
          label: "Capaian Pembelajaran / Daftar Materi (opsional)",
          type: "textarea",
          colSpan: 2,
          placeholder: "Kosongkan agar AI menyusun CP semester, TP, distribusi JP, asesmen, dan P5.",
        },
      ],
    },
  ],
  "surat-dinas": [
    {
      id: "konteks",
      label: "Detail Surat",
      fields: [
        { name: "jenisSurat", label: "Jenis Surat", type: "text", placeholder: "Undangan Rapat" },
        { name: "perihal", label: "Perihal", type: "text", colSpan: 2 },
        { name: "tujuan", label: "Tujuan / Penerima", type: "text" },
        { name: "isi", label: "Poin-poin Isi Surat", type: "textarea", colSpan: 2 },
      ],
    },
  ],
};

export function getToolFormSteps(slug: string): ToolFormStep[] {
  return (
    TOOL_FORMS[slug] || [
      {
        id: "input",
        label: "Input",
        fields: [
          { name: "mapel", label: "Mata Pelajaran", type: "text" },
          { name: "topik", label: "Topik", type: "text", required: true, colSpan: 2 },
          { name: "keterangan", label: "Keterangan Tambahan", type: "textarea", colSpan: 2 },
        ],
      },
    ]
  );
}
