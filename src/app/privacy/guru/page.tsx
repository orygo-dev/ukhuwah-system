import type { Metadata } from "next";
import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { getAppDisplayConfig, resolveAppName } from "@/lib/app-display";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — Navalogi (Guru)",
  description:
    "Kebijakan privasi aplikasi Navalogi, termasuk penggunaan Google AdMob dan pilihan privasi iklan.",
  robots: { index: true, follow: true },
};

const effectiveDate = "1 September 2026";
const contactEmail = "privasi@guruspaceai.cloud";
const appPackage = "com.genpro.teacher";

const sections = [
  {
    id: "pendahuluan",
    title: "1. Pendahuluan",
    body: [
      "Kebijakan ini menjelaskan bagaimana Navalogi sebagai pengelola Navalogi memproses dan melindungi data pengguna aplikasi guru.",
      "Navalogi ditujukan bagi guru, tenaga pendidik, dan pengguna profesional yang berwenang menggunakan layanan sekolah.",
    ],
  },
  {
    id: "pengelola",
    title: "2. Pengelola dan aplikasi",
    body: [
      "Pengelola data: Navalogi, melalui layanan guruspaceai.cloud.",
      `Kontak privasi: ${contactEmail}.`,
      `Nama aplikasi: Navalogi. ID paket Android: ${appPackage}.`,
    ],
  },
  {
    id: "data",
    title: "3. Data yang dapat diproses",
    body: ["Sesuai fitur yang digunakan, Navalogi dapat memproses:"],
    bullets: [
      "Data akun dan profesi: nama, email, identitas sekolah, peran, profil, serta status layanan.",
      "Data administrasi dan pembelajaran yang dibuat atau dikelola guru, termasuk kelas, tugas, penilaian, absensi, dan dokumen generator.",
      "Data komunikasi dan kelas daring, termasuk notifikasi, token perangkat, serta audio/video yang diaktifkan dalam PJJ.",
      "Data teknis dan keamanan: perangkat, sistem operasi, sesi, diagnostik, log kesalahan, dan informasi yang diperlukan untuk mencegah penyalahgunaan.",
      "Data iklan: Google Mobile Ads SDK dapat memproses pengenal aplikasi/perangkat, alamat IP, informasi perangkat, diagnostik, tayangan, dan interaksi iklan.",
    ],
  },
  {
    id: "tujuan",
    title: "4. Tujuan pemrosesan",
    body: ["Data digunakan untuk menyediakan layanan, menjaga keamanan, menyelenggarakan pembelajaran, memberi dukungan, memenuhi kewajiban hukum, dan meningkatkan stabilitas aplikasi."],
  },
  {
    id: "iklan",
    title: "5. Google AdMob dan pilihan privasi",
    body: [
      "Zona Kreasi pada aplikasi Android dapat menampilkan iklan Native Google AdMob. Navalogi tidak mengirim isi dokumen guru, data siswa, nilai, sekolah, kelas, atau isi pesan kepada Google untuk menentukan iklan.",
      "Saat ini Navalogi menerapkan konfigurasi konservatif berupa perlakuan iklan remaja (TEEN) dan rating konten maksimum PG juga pada aplikasi guru. Konfigurasi ini menonaktifkan personalisasi dan remarketing meskipun pengguna guru pada umumnya dewasa.",
      "Google User Messaging Platform (UMP) digunakan untuk memeriksa dan menampilkan pilihan privasi yang diwajibkan. Jika tersedia, pilihan tersebut dapat dibuka kembali melalui Profil → Privasi iklan.",
      "Ketersediaan, isi, pengukuran, dan pendapatan iklan ditentukan Google. Pengguna tidak diwajibkan mengklik iklan dan dilarang melakukan klik tidak wajar.",
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
    id: "berbagi",
    title: "6. Berbagi data",
    body: [
      "Data hanya dibagikan sesuai kebutuhan layanan kepada sekolah atau pengelola yang berwenang, penyedia infrastruktur, Google untuk fungsi iklan yang dijelaskan di atas, dan otoritas jika diwajibkan hukum.",
      "Navalogi tidak menjual data pribadi guru maupun data pendidikan kepada pihak ketiga.",
    ],
  },
  {
    id: "keamanan",
    title: "7. Penyimpanan dan keamanan",
    body: [
      "Data disimpan selama akun aktif dan selama diperlukan untuk layanan, keamanan, kewajiban hukum, atau penyelesaian sengketa. Kami menerapkan kontrol akses dan perlindungan jalur komunikasi HTTPS serta dapat menghapus atau menganonimkan data yang tidak lagi diperlukan.",
    ],
  },
  {
    id: "hak",
    title: "8. Hak dan pilihan pengguna",
    body: [
      "Pengguna dapat meminta akses, koreksi, penghapusan atau pembatasan sesuai hukum; menonaktifkan izin perangkat; dan membuka kembali pilihan privasi iklan melalui menu Profil.",
      `Permintaan privasi dapat dikirim ke ${contactEmail}. Verifikasi identitas dapat diperlukan sebelum permintaan diproses.`,
    ],
  },
  {
    id: "penghapusan",
    title: "9. Penghapusan akun",
    body: [
      "Permintaan penutupan atau penghapusan akun dapat diajukan melalui pengaturan layanan, administrator yang berwenang, atau kontak privasi. Sebagian catatan dapat dipertahankan jika diwajibkan untuk administrasi pendidikan atau hukum.",
    ],
  },
  {
    id: "perubahan",
    title: "10. Perubahan kebijakan",
    body: [
      "Kebijakan dapat diperbarui dari waktu ke waktu. Tanggal berlaku akan diperbarui dan perubahan material dapat diinformasikan melalui aplikasi atau situs.",
    ],
  },
  {
    id: "kontak",
    title: "11. Kontak",
    body: [
      `Email: ${contactEmail}`,
      "Situs: https://guruspaceai.cloud",
    ],
  },
] as const;

export default async function TeacherPrivacyPolicyPage() {
  const display = await getAppDisplayConfig().catch(() => null);
  const appName = display ? resolveAppName(display) : APP_NAME;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="inline-flex items-center gap-2" href="/">
            <AppLogo
              appName={appName}
              showName
              className="gap-2"
              imageClassName="h-8 w-auto"
              fallbackClassName="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white"
            />
          </Link>
          <span className="text-xs font-medium text-slate-500 sm:text-sm">
            Kebijakan Privasi · Navalogi
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium text-sky-700">Navalogi · Aplikasi Guru</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
          Kebijakan Privasi
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Berlaku efektif: {effectiveDate}. Versi untuk aplikasi Android Navalogi ({appPackage}).
        </p>

        <nav className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Daftar isi</p>
          <ol className="mt-3 grid gap-1.5 text-sm text-sky-800 sm:grid-cols-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a className="hover:underline" href={`#${section.id}`}>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section className="scroll-mt-24" id={section.id} key={section.id}>
              <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 sm:text-[15px]">
                {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {"bullets" in section && section.bullets ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                ) : null}
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
          Dokumen ini merupakan pemberitahuan privasi Navalogi dan mendukung persyaratan distribusi aplikasi, termasuk Google Play.
        </p>
      </main>

      <MarketingFooter branding={display?.branding} />
    </div>
  );
}
