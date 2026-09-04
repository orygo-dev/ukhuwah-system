import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { APP_NAME } from "@/lib/constants";
import { getAppDisplayConfig, resolveAppName } from "@/lib/app-display";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Navalogi (Siswa)",
  description:
    "Kebijakan privasi aplikasi Navalogi untuk siswa: data yang dikumpulkan, tujuan pemrosesan, dan hak pengguna.",
  robots: { index: true, follow: true },
};

const effectiveDate = "1 September 2026";
const contactEmail = "privasi@guruspaceai.cloud";
const appPackage = "com.genpro.app";

const sections = [
  {
    id: "pendahuluan",
    title: "1. Pendahuluan",
    body: [
      "Kebijakan Privasi ini menjelaskan bagaimana Navalogi (pengelola platform) mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi pengguna aplikasi Navalogi untuk siswa (\"Aplikasi\").",
      "Aplikasi ditujukan untuk mendukung kegiatan belajar siswa yang terdaftar melalui sekolah atau lembaga mitra di Indonesia. Dengan menggunakan Aplikasi, Anda memahami praktik privasi yang dijelaskan di sini.",
    ],
  },
  {
    id: "pengelola",
    title: "2. Pengelola data",
    body: [
      "Pengelola data: Navalogi (platform pendidikan digital yang beroperasi melalui layanan di guruspaceai.cloud).",
      `Kontak privasi: ${contactEmail}`,
      `Nama Aplikasi: Navalogi (siswa). ID paket Android: ${appPackage}.`,
    ],
  },
  {
    id: "data",
    title: "3. Data yang kami kumpulkan",
    body: [
      "Kami dapat memproses kategori data berikut, sesuai fitur yang Anda gunakan dan pengaturan sekolah:",
    ],
    bullets: [
      "Data akun: nama, email/username, kata sandi (disimpan secara terenkripsi/hashed), identitas sekolah/kelas, dan peran sebagai siswa.",
      "Data profil: foto profil (avatar) jika Anda mengunggahnya dari kamera atau galeri.",
      "Data pembelajaran: tugas, kuis, ujian, nilai, absensi, progres Zona Baca, serta aktivitas terkait mading/Zona Kreasi.",
      "Data komunikasi layanan: notifikasi dalam aplikasi, token perangkat untuk push notification (Firebase Cloud Messaging), dan log sesi login.",
      "Data kelas daring (PJJ): audio/video saat Anda mengaktifkan mikrofon/kamera di ruang kelas live; aliran media diproses untuk menyelenggarakan kelas.",
      "Data teknis: jenis perangkat, sistem operasi, log kesalahan/kinerja yang diperlukan untuk menjaga keamanan dan stabilitas layanan.",
      "Data iklan: Google Mobile Ads SDK dapat memproses pengenal aplikasi/perangkat, alamat IP, informasi perangkat, diagnostik, serta interaksi dan tayangan iklan untuk menayangkan, mengukur, mengamankan, dan mencegah penyalahgunaan iklan.",
    ],
  },
  {
    id: "tidak-dikumpulkan",
    title: "4. Data yang tidak kami kumpulkan secara sengaja",
    body: [
      "Aplikasi tidak meminta akses lokasi GPS secara khusus untuk pelacakan.",
      "Aplikasi tidak menjual data pribadi siswa kepada pihak ketiga untuk iklan bertarget berbasis data pribadi.",
      "Navalogi tidak mengirimkan nama, nilai, absensi, tugas, sekolah, kelas, isi pesan, atau karya siswa kepada Google untuk menentukan iklan.",
      "Kami tidak mengumpulkan data sensitif di luar keperluan pendidikan yang dijelaskan dalam kebijakan ini, kecuali diwajibkan hukum atau diminta secara eksplisit untuk fitur tertentu dengan persetujuan.",
    ],
  },
  {
    id: "izin",
    title: "5. Izin perangkat",
    body: [
      "Aplikasi dapat meminta izin berikut, hanya saat fitur terkait digunakan:",
    ],
    bullets: [
      "Internet — untuk login, sinkronisasi data, dan konten pembelajaran.",
      "Kamera — untuk foto profil dan partisipasi video di kelas daring (PJJ).",
      "Mikrofon — untuk audio di kelas daring (PJJ).",
      "Bluetooth (hubungkan) — mendukung perangkat audio saat sesi media/kelas.",
      "Notifikasi — mengirim pemberitahuan tugas, pengumuman, atau aktivitas sekolah.",
    ],
  },
  {
    id: "tujuan",
    title: "6. Tujuan pemrosesan",
    body: [
      "Data diproses untuk:",
    ],
    bullets: [
      "Menyediakan dan mengamankan layanan pendidikan (login, kelas, tugas, nilai, absensi, mading, Zona Baca, dan fitur terkait).",
      "Menyelenggarakan kelas daring (PJJ) termasuk transmisi audio/video.",
      "Mengirim notifikasi yang relevan dengan aktivitas belajar.",
      "Meningkatkan keamanan, mencegah penyalahgunaan, dan memperbaiki gangguan teknis.",
      "Memenuhi kewajiban hukum atau permintaan resmi yang sah.",
      "Menghasilkan laporan agregat/anonim untuk sekolah atau pengelola platform (misalnya rekap partisipasi), tanpa tujuan penjualan data pribadi.",
    ],
  },
  {
    id: "dasar",
    title: "7. Dasar pemrosesan",
    body: [
      "Pemrosesan dilakukan berdasarkan: (a) pelaksanaan layanan pendidikan yang diminta sekolah/pengguna; (b) kepentingan sah untuk keamanan dan operasional platform; (c) persetujuan untuk fitur opsional seperti unggah foto atau izin kamera/mikrofon; dan/atau (d) kewajiban hukum yang berlaku di Indonesia.",
    ],
  },
  {
    id: "iklan",
    title: "8. Iklan Google AdMob dan pilihan privasi",
    body: [
      "Aplikasi Android dapat menampilkan iklan Native dari Google AdMob sebagai item mandiri pada feed Zona Kreasi dan preview Mading, serta iklan Banner pada daftar Zona Baca, Mading, Tugas, dan Quiz. Iklan tidak ditempatkan pada login, komunikasi, PJJ, formulir, maupun saat siswa mengerjakan tugas atau ujian. Ketersediaan, isi, pengukuran, dan pendapatan iklan ditentukan oleh Google dan konfigurasi pengelola.",
      "Untuk akun siswa, Navalogi meminta perlakuan iklan remaja (TEEN) dan membatasi rating konten iklan hingga PG. Perlakuan ini menonaktifkan personalisasi dan remarketing serta menerapkan perlindungan penayangan iklan bagi remaja. Iklan tetap dapat dipilih berdasarkan konteks umum aplikasi atau faktor non-personal.",
      "Sebelum meminta iklan, aplikasi menggunakan Google User Messaging Platform (UMP) untuk memeriksa apakah pesan privasi atau persetujuan diwajibkan di wilayah pengguna. Jika pilihan privasi tersedia, pengguna dapat membukanya kembali melalui Profil → Privasi iklan.",
      "Pengguna tidak diwajibkan mengklik iklan. Jangan mengklik iklan dengan tujuan menghasilkan pendapatan secara tidak wajar atau melakukan pengujian terhadap iklan produksi.",
    ],
    links: [
      { href: "https://policies.google.com/privacy", label: "Kebijakan Privasi Google" },
      {
        href: "https://policies.google.com/technologies/ads",
        label: "Cara Google menggunakan data untuk iklan",
      },
    ],
  },
  {
    id: "anak",
    title: "9. Pengguna remaja dan pengguna di bawah umur",
    body: [
      "Aplikasi siswa Navalogi dan konfigurasi AdMob saat ini ditujukan bagi pengguna remaja berusia minimal 13 tahun. Akun siswa umumnya disediakan atau dikelola melalui sekolah/orang tua/wali.",
      "Jika sekolah akan memberikan akses kepada anak di bawah 13 tahun atau di bawah batas usia digital yang berlaku, sekolah wajib menghubungi pengelola terlebih dahulu. Penayangan AdMob untuk pengguna tersebut harus dinonaktifkan atau memakai perlakuan anak (CHILD) setelah peninjauan kebijakan yang sesuai.",
      "Jika Anda adalah orang tua/wali dan ingin meninjau, memperbaiki, atau meminta penghapusan data anak, hubungi sekolah terkait dan/atau kirim permintaan ke kontak privasi di bawah, dengan informasi yang memadai untuk verifikasi.",
    ],
  },
  {
    id: "berbagi",
    title: "10. Berbagi data dengan pihak lain",
    body: [
      "Data dapat diakses oleh:",
    ],
    bullets: [
      "Sekolah/guru yang berwenang, sesuai peran dan kebijakan internal sekolah, untuk keperluan pembelajaran dan administrasi.",
      "Penyedia infrastruktur teknis yang membantu operasional layanan (misalnya hosting cloud, pengiriman push notification, atau infrastruktur media kelas daring), terbatas pada data yang diperlukan dan dengan kewajiban kerahasiaan yang wajar.",
      "Google sebagai penyedia Google Mobile Ads SDK, AdMob, dan UMP, terbatas pada data teknis dan interaksi iklan sebagaimana dijelaskan pada bagian iklan di atas.",
      "Otoritas yang berwenang jika diwajibkan oleh hukum.",
    ],
    bodyAfter: [
      "Kami tidak menjual data pribadi siswa.",
    ],
  },
  {
    id: "penyimpanan",
    title: "11. Penyimpanan dan keamanan",
    body: [
      "Data disimpan pada sistem yang dikelola Navalogi dan/atau mitra infrastruktur dengan pengamanan yang wajar (kontrol akses, enkripsi pada jalur komunikasi HTTPS, serta praktik keamanan standar industri).",
      "Data disimpan selama akun aktif dan selama diperlukan untuk tujuan pendidikan, kewajiban hukum, atau penyelesaian sengketa. Setelah tidak diperlukan, data dapat dihapus atau dianonimkan sesuai prosedur operasional.",
    ],
  },
  {
    id: "hak",
    title: "12. Hak dan pilihan Anda",
    body: [
      "Sesuai ketentuan hukum yang berlaku, Anda (atau orang tua/wali untuk siswa di bawah umur) dapat meminta:",
    ],
    bullets: [
      "Akses dan salinan data pribadi tertentu.",
      "Perbaikan data yang tidak akurat.",
      "Penghapusan atau pembatasan pemrosesan dalam kondisi yang diizinkan hukum (dapat dipengaruhi kewajiban penyimpanan data pendidikan sekolah).",
      "Penarikan persetujuan untuk fitur opsional (misalnya menonaktifkan kamera/mikrofon/notifikasi di perangkat).",
      "Membuka kembali pilihan privasi iklan yang tersedia melalui Profil → Privasi iklan.",
    ],
    bodyAfter: [
      `Ajukan permintaan melalui ${contactEmail} atau melalui administrasi sekolah Anda. Kami dapat meminta verifikasi identitas sebelum memproses permintaan.`,
    ],
  },
  {
    id: "retensi-akun",
    title: "13. Penghapusan akun",
    body: [
      "Untuk menutup atau menghapus akun siswa, hubungi guru/admin sekolah atau kirim permintaan ke kontak privasi. Penghapusan dapat memerlukan konfirmasi sekolah karena data terkait catatan pembelajaran.",
    ],
  },
  {
    id: "perubahan",
    title: "14. Perubahan kebijakan",
    body: [
      "Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu. Tanggal berlaku akan diperbarui di bagian atas halaman. Perubahan material dapat diinformasikan melalui Aplikasi, situs, atau saluran sekolah.",
    ],
  },
  {
    id: "kontak",
    title: "15. Kontak",
    body: [
      "Pertanyaan terkait privasi Navalogi (siswa):",
      `Email: ${contactEmail}`,
      "Situs: https://guruspaceai.cloud",
    ],
  },
] as const;

export default async function StudentPrivacyPolicyPage() {
  const display = await getAppDisplayConfig().catch(() => null);
  const appName = display ? resolveAppName(display) : APP_NAME;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <AppLogo
              appName={appName}
              showName
              className="gap-2"
              imageClassName="h-8 w-auto"
              fallbackClassName="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white"
            />
          </Link>
          <span className="text-xs font-medium text-slate-500 sm:text-sm">
            Kebijakan Privasi · Navalogi Siswa
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium text-sky-700">Navalogi · Aplikasi Siswa</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          Kebijakan Privasi
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Berlaku efektif: {effectiveDate}. Versi untuk pengguna aplikasi Android Navalogi
          ({appPackage}).
        </p>

        <nav className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Daftar isi</p>
          <ol className="mt-3 grid gap-1.5 text-sm text-sky-800 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {"bullets" in section && section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {"bodyAfter" in section && section.bodyAfter
                  ? section.bodyAfter.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))
                  : null}
                {"links" in section && section.links ? (
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <a
                          className="font-medium text-sky-700 underline-offset-4 hover:underline"
                          href={link.href}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
          Dokumen ini merupakan pemberitahuan privasi untuk keperluan layanan Navalogi siswa dan
          persyaratan distribusi aplikasi (termasuk Google Play). Dokumen tidak menggantikan
          kebijakan internal sekolah yang mungkin berlaku tambahan bagi peserta didik.
        </p>
      </main>

      <MarketingFooter branding={display?.branding} />
    </div>
  );
}
