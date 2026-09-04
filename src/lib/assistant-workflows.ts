import { TOOLS } from "@/lib/constants";

export type AssistantWorkflowId =
  | "semester"
  | "mengajar"
  | "evaluasi"
  | "ujian"
  | "tindak-lanjut"
  | "administrasi";

export type AssistantWorkflowItem = {
  toolSlug: string;
  required?: boolean;
  note: string;
};

export type AssistantWorkflow = {
  id: AssistantWorkflowId;
  title: string;
  description: string;
  goal: string;
  items: AssistantWorkflowItem[];
};

export const ASSISTANT_WORKFLOWS: AssistantWorkflow[] = [
  {
    id: "semester",
    title: "Persiapan Semester",
    description: "ATP, PROTA, PROMES, dan dokumen awal semester.",
    goal: "Pastikan struktur pembelajaran semester sudah lengkap sebelum masuk ke pertemuan rutin.",
    items: [
      { toolSlug: "atp", required: true, note: "Alur utama pembelajaran semester." },
      { toolSlug: "prota", required: true, note: "Distribusi materi tahunan." },
      { toolSlug: "prosem", required: true, note: "Rencana semester berdasarkan ATP/PROTA." },
      { toolSlug: "asesmen-diagnostik", note: "Cek kesiapan awal siswa." },
      { toolSlug: "modul-ajar", note: "Rencana pertemuan pertama." },
    ],
  },
  {
    id: "mengajar",
    title: "Persiapan Mengajar",
    description: "Modul ajar, materi, LKPD, dan jurnal harian.",
    goal: "Siapkan perangkat yang langsung dipakai untuk kegiatan kelas berikutnya.",
    items: [
      { toolSlug: "modul-ajar", required: true, note: "Rencana pembelajaran utama." },
      { toolSlug: "bahan-ajar", required: true, note: "Materi siap disampaikan ke siswa." },
      { toolSlug: "lkpd", note: "Aktivitas siswa di kelas." },
      { toolSlug: "jurnal-mengajar", note: "Catatan mengajar setelah kegiatan." },
    ],
  },
  {
    id: "evaluasi",
    title: "Evaluasi Pembelajaran",
    description: "Kisi-kisi, kartu soal, bank soal, rubrik, dan narasi.",
    goal: "Bangun perangkat evaluasi yang konsisten dari indikator sampai umpan balik siswa.",
    items: [
      { toolSlug: "kisi-kisi-soal", required: true, note: "Peta indikator dan level soal." },
      { toolSlug: "kartu-soal", required: true, note: "Detail butir, kunci, dan pembahasan." },
      { toolSlug: "bank-soal", required: true, note: "Paket soal siap pakai." },
      { toolSlug: "rubrik", note: "Pedoman penilaian kinerja/produk." },
      { toolSlug: "narasi-rapor", note: "Umpan balik capaian siswa." },
    ],
  },
  {
    id: "ujian",
    title: "Persiapan Ujian",
    description: "Perangkat ujian dari kisi-kisi sampai penskoran.",
    goal: "Siapkan asesmen sumatif yang terstruktur, transparan, dan mudah diperiksa.",
    items: [
      { toolSlug: "kisi-kisi-soal", required: true, note: "Dasar penyusunan ujian." },
      { toolSlug: "kartu-soal", required: true, note: "Validasi tiap butir soal." },
      { toolSlug: "bank-soal", required: true, note: "Paket soal akhir." },
      { toolSlug: "rubrik", note: "Rubrik untuk esai/proyek/praktik." },
    ],
  },
  {
    id: "tindak-lanjut",
    title: "Tindak Lanjut Nilai",
    description: "Analisis hasil, remedial, pengayaan, dan narasi rapor.",
    goal: "Ubah hasil penilaian menjadi keputusan pembelajaran yang jelas.",
    items: [
      { toolSlug: "analisis-penilaian", required: true, note: "Pemetaan ketuntasan siswa." },
      { toolSlug: "remedial-pengayaan", required: true, note: "Program untuk siswa belum dan sudah tuntas." },
      { toolSlug: "narasi-rapor", note: "Deskripsi capaian yang humanis." },
    ],
  },
  {
    id: "administrasi",
    title: "Administrasi Kelas",
    description: "Jurnal mengajar dan surat dinas sekolah.",
    goal: "Lengkapi catatan dan komunikasi administratif guru.",
    items: [
      { toolSlug: "jurnal-mengajar", required: true, note: "Rekam aktivitas pembelajaran." },
      { toolSlug: "surat-dinas", note: "Surat resmi untuk kebutuhan sekolah." },
    ],
  },
];

export function getAssistantTool(slug: string) {
  return TOOLS.find((tool) => tool.slug === slug);
}
