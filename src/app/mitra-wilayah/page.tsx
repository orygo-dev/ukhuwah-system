import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Handshake,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { CommissionCalculatorDemo } from "@/components/marketing/commission-calculator-demo";
import { getAppDisplayConfig, resolveAppName } from "@/lib/app-display";

export const dynamic = "force-dynamic";

const partnerApplicationEmail = "kemitraan@guruspaceai.cloud";

const benefits = [
  {
    title: "Komisi dari paket premium",
    description:
      "Mitra mendapatkan komisi dari guru atau sekolah binaan yang membeli paket premium Navalogi.",
    icon: Wallet,
  },
  {
    title: "Dashboard performa wilayah",
    description:
      "Pantau guru binaan, nilai transaksi premium, saldo komisi, dan riwayat pencairan secara transparan.",
    icon: BarChart3,
  },
  {
    title: "Program lapangan lebih terarah",
    description:
      "Cocok untuk koordinator kabupaten, komunitas guru, operator sekolah, atau pihak yang aktif melakukan sosialisasi.",
    icon: MapPin,
  },
  {
    title: "Dukungan ekosistem Navalogi",
    description:
      "Mitra dapat membawa solusi administrasi AI yang relevan untuk kebutuhan harian guru dan sekolah.",
    icon: Sparkles,
  },
];

const requirements = [
  "Memiliki jaringan atau akses komunikasi dengan guru, sekolah, komunitas, atau pemangku kepentingan wilayah.",
  "Bersedia melakukan edukasi penggunaan Navalogi secara etis, jelas, dan tidak menyesatkan.",
  "Memiliki identitas, nomor WhatsApp, data rekening, dan area kerja yang dapat diverifikasi.",
  "Tidak membuat klaim harga, komisi, atau kebijakan di luar ketentuan resmi Navalogi.",
  "Menjaga data guru dan sekolah binaan sesuai kebutuhan operasional dan privasi pengguna.",
];

const steps = [
  {
    title: "Kirim pengajuan",
    description:
      "Calon mitra mengirim profil singkat, wilayah kerja, jaringan binaan, dan rencana sosialisasi ke tim Navalogi.",
  },
  {
    title: "Verifikasi area",
    description:
      "Super admin meninjau wilayah kerja, kategori mitra, dan potensi kerja sama agar tidak tumpang tindih.",
  },
  {
    title: "Akun mitra dibuat",
    description:
      "Setelah disetujui, mitra menerima kode login untuk masuk ke portal mitra wilayah.",
  },
  {
    title: "Pantau komisi",
    description:
      "Setiap pembelian paket premium dari wilayah atau kode mitra tercatat untuk perhitungan komisi.",
  },
];

const faqs = [
  {
    question: "Apa itu Mitra Wilayah Navalogi?",
    answer:
      "Mitra Wilayah adalah pihak yang membantu memperkenalkan dan mendampingi penggunaan Navalogi di area tertentu, misalnya kabupaten, komunitas guru, atau jaringan sekolah.",
  },
  {
    question: "Komisi dihitung dari transaksi apa?",
    answer:
      "Komisi difokuskan pada pembelian paket premium yang terhubung dengan wilayah atau kode mitra. Topup kredit dan pemakaian kredit tidak menjadi dasar komisi mitra wilayah.",
  },
  {
    question: "Apakah mitra harus seorang guru?",
    answer:
      "Tidak harus. Mitra dapat berasal dari komunitas pendidikan, koordinator wilayah, operator, atau pihak lain yang memiliki akses lapangan dan disetujui super admin.",
  },
  {
    question: "Bagaimana mitra melihat komisi?",
    answer:
      "Mitra yang sudah disetujui dapat login ke portal mitra untuk melihat ringkasan wilayah, transaksi premium, saldo komisi, dan riwayat pencairan.",
  },
  {
    question: "Apakah satu wilayah bisa memiliki banyak mitra?",
    answer:
      "Bisa diatur oleh super admin sesuai kebijakan kerja sama. Tujuannya agar pembagian wilayah, kode mitra, dan perhitungan komisi tetap jelas.",
  },
  {
    question: "Bagaimana cara mendaftar?",
    answer:
      "Calon mitra menghubungi tim Navalogi atau super admin, lalu mengikuti proses verifikasi wilayah, identitas, rekening, dan skema kerja sama.",
  },
];

export default async function MitraWilayahPage() {
  const config = await getAppDisplayConfig();
  const branding = {
    appName: resolveAppName(config),
    logoUrl: config.branding.logoUrl,
    authLogoUrl: config.branding.authLogoUrl,
    loginTagline: config.branding.loginTagline,
    loginSubtitle: config.branding.loginSubtitle,
  };
  const appName = branding.appName;

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/[0.96] shadow-[0_8px_30px_rgba(15,76,129,0.06)] backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <AppLogo
            href="/"
            appName={appName}
            logoUrl={branding.logoUrl}
            showName={false}
            imageClassName="h-10 w-auto max-w-[170px] object-contain"
            fallbackClassName="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-sm font-black text-white shadow-md shadow-emerald-600/20"
          />
          <nav className="hidden items-center gap-8 md:flex">
            <Link href="#manfaat" className="text-sm font-bold text-slate-500 hover:text-slate-950">
              Manfaat
            </Link>
            <Link href="#cara-daftar" className="text-sm font-bold text-slate-500 hover:text-slate-950">
              Cara Daftar
            </Link>
            <Link href="#faq" className="text-sm font-bold text-slate-500 hover:text-slate-950">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/login">Login Guru</Link>
            </Button>
            <Button variant="brand" asChild>
              <Link href="/partner/login">Portal Mitra</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,hsl(214_100%_98%)_0%,white_72%)]">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-200/35 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-4 py-2 text-sm font-extrabold text-emerald-700 shadow-sm">
              <Handshake className="h-4 w-4" />
              Program Mitra Wilayah
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              Bantu guru di wilayah Anda memakai AI administrasi, dan dapatkan
              komisi dari paket premium.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Navalogi membuka peluang kerja sama untuk pihak lapangan yang
              aktif mengenalkan solusi administrasi guru ke sekolah, komunitas,
              atau wilayah binaan secara terukur.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button variant="brand" size="lg" asChild className="rounded-xl">
                <Link href={`mailto:${partnerApplicationEmail}?subject=Pengajuan%20Mitra%20Wilayah%20Guru%20Space`}>
                  Ajukan Kemitraan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="rounded-xl border-emerald-200 bg-white">
                <Link href="#cara-daftar">Lihat Cara Daftar</Link>
              </Button>
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[32px] border border-emerald-100 bg-white p-5 shadow-[0_28px_90px_rgba(15,76,129,0.14)]">
              <div className="overflow-hidden rounded-[24px] gradient-brand p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-100">Ilustrasi dashboard mitra</p>
                    <h2 className="mt-2 text-2xl font-extrabold">Wilayah binaan aktif</h2>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-emerald-700">
                    <MapPin className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Guru binaan", "248"],
                    ["Premium aktif", "86"],
                    ["Komisi bulan ini", "Rp 4,8 jt"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/15 bg-white/12 p-4 backdrop-blur">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-100">
                        {label}
                      </p>
                      <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-white p-4 text-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold">Transaksi premium tercatat</p>
                      <p className="text-xs text-slate-500">
                        Setiap komisi bisa dilacak dari portal mitra.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="manfaat" className="border-y border-blue-50 bg-slate-50/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Keuntungan mitra
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              Skema kerja sama yang mudah dipantau dan relevan untuk aktivitas lapangan.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <article
                  key={benefit.title}
                  className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_16px_50px_rgba(15,76,129,0.08)]"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-extrabold text-slate-950">{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{benefit.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Syarat utama
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              Mitra dipilih agar kerja sama tetap jelas, etis, dan terukur.
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Program ini cocok untuk pihak yang benar-benar memiliki peran
              lapangan dan bisa membantu guru memahami manfaat Navalogi.
            </p>
          </div>
          <div className="rounded-[28px] border border-emerald-100 bg-white p-6 shadow-[0_18px_70px_rgba(15,76,129,0.1)]">
            <div className="space-y-4">
              {requirements.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm leading-6 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="cara-daftar" className="bg-[linear-gradient(180deg,white_0%,hsl(214_100%_98%)_100%)] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                Cara mendaftar
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
                Alur sederhana dari pengajuan sampai komisi berjalan.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Akun mitra tidak dibuat mandiri untuk menjaga kualitas wilayah,
                validasi identitas, dan kejelasan pembagian komisi.
              </p>
              <div className="mt-6 rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_16px_50px_rgba(15,76,129,0.08)]">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-950">
                      Kirim pengajuan ke tim Navalogi
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Sertakan nama lengkap, nomor WhatsApp, wilayah yang diajukan,
                      profil jaringan, dan rencana sosialisasi singkat.
                    </p>
                    <Button variant="brand" asChild className="mt-4 rounded-xl">
                      <Link href={`mailto:${partnerApplicationEmail}?subject=Pengajuan%20Mitra%20Wilayah%20Guru%20Space`}>
                        Email Pengajuan
                      </Link>
                    </Button>
                    <p className="mt-3 text-xs font-semibold text-slate-500">
                      Email tujuan: {partnerApplicationEmail}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {steps.map((step, index) => (
                <article key={step.title} className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white">
                      {index + 1}
                    </div>
                    <h3 className="text-base font-extrabold text-slate-950">{step.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <CommissionCalculatorDemo />
        </div>
      </section>

      <section id="faq" className="border-t border-blue-50 bg-slate-50/70 py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">
              Q&A
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              Pertanyaan umum calon mitra wilayah.
            </h2>
          </div>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_12px_45px_rgba(15,76,129,0.07)]"
              >
                <h3 className="text-base font-extrabold text-slate-950">{faq.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-emerald-100 bg-white p-8 text-center shadow-[0_24px_90px_rgba(15,76,129,0.12)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-slate-950">
            Sudah menjadi mitra resmi?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Masuk ke portal mitra untuk memantau wilayah binaan, transaksi
            premium, saldo komisi, dan pengajuan pencairan.
          </p>
          <div className="mt-7 flex justify-center">
            <Button variant="brand" size="lg" asChild className="rounded-xl">
              <Link href="/partner/login">Masuk Portal Mitra</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter branding={branding} />
    </main>
  );
}
