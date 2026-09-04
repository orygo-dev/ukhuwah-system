import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLandingBranding } from "@/lib/landing-page";
import {
  getPublicCatalog,
  type CatalogAudience,
  type PublicCatalog,
} from "@/lib/landing-catalog";
import { InformationShell } from "./information-page";
import styles from "./information-page.module.css";

const titles = { guru: "Paket Guru", sekolah: "Paket Sekolah" };
export async function packageMetadata(
  audience?: CatalogAudience,
): Promise<Metadata> {
  const brand = await getLandingBranding();
  return {
    title: {
      absolute: `${audience ? titles[audience] : "Paket Guru dan Sekolah"} — ${brand.appName}`,
    },
    description:
      "Lihat harga, kuota, dan manfaat paket aktif. Pahami perbedaan langganan guru pribadi dan langganan sekolah sebelum masuk untuk membeli.",
  };
}
const rupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

export function CatalogContent({
  audience,
  catalog,
}: {
  audience: CatalogAudience;
  catalog: PublicCatalog;
}) {
  const school = audience === "sekolah";
  const destination = school ? "/school/subscription" : "/dashboard/billing";
  const name = school ? "sekolah" : "guru";
  return (
    <section className={styles.catalog} aria-label={`Katalog paket ${name}`}>
      <h2>{titles[audience]}</h2>
      <p>
        {school
          ? "Untuk pengelolaan bersama. Harga per sekolah; kapasitas dan fitur mengikuti paket. PJJ memerlukan akses/add-on yang berlaku dan tetap maksimal 25 peserta per ruang."
          : "Untuk kebutuhan pribadi guru. Harga per akun guru; kredit dan fitur mengikuti paket. Checkout guru saat ini menggunakan periode bulanan."}
      </p>
      {catalog.status !== "ready" ? (
        <div className={styles.notice} role="status">
          <p>
            {catalog.status === "unavailable"
              ? `Katalog paket ${name} belum dapat dimuat. Harga tidak ditampilkan agar tidak memberi informasi yang keliru. Silakan coba lagi nanti.`
              : catalog.status === "disabled"
                ? "Penawaran paket sekolah belum diaktifkan pada layanan ini. Hubungi pengelola platform melalui sekolah Anda untuk informasi aktivasi."
                : `Belum ada paket ${name} aktif yang tersedia. Pengelola belum menerbitkan penawaran; ini bukan berarti semua fitur gratis.`}
          </p>
          <p>
            <a href={school ? "/untuk-sekolah" : "/fitur/ai"}>
              Pelajari cara kerja dan aksesnya
            </a>
          </p>
          {catalog.status === "unavailable" && (
            <p>
              <a href={`/paket/${audience}`}>Coba muat ulang katalog {name}</a>
            </p>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {catalog.plans.map((plan) => (
            <article className={styles.card} key={plan.slug}>
              <h3>{plan.name}</h3>
              {plan.description && <p>{plan.description}</p>}
              <p className={styles.price}>
                {school && plan.monthly <= 0
                  ? "Bulanan belum ditawarkan"
                  : rupiah(plan.monthly)}
                {(!school || plan.monthly > 0) && <span> / bulan</span>}
              </p>
              {school && (
                <p>
                  {plan.yearly && plan.yearly > 0
                    ? `${rupiah(plan.yearly)} / tahun`
                    : "Tahunan belum ditawarkan"}
                </p>
              )}
              <ul>
                {plan.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              {school ? (
                plan.monthly > 0 || (plan.yearly ?? 0) > 0 ? (
                  <a href={destination}>
                    Masuk sebagai admin untuk melihat langganan →
                  </a>
                ) : (
                  <p>Pembayaran mandiri belum tersedia untuk paket ini.</p>
                )
              ) : plan.monthly > 0 ? (
                <a href={destination}>
                  Masuk sebagai guru untuk melihat langganan →
                </a>
              ) : (
                <p>
                  Paket tanpa biaya langganan. Penetapan paket dan akses
                  mengikuti akun; bukan tombol pembelian.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

async function Catalog({ audience }: { audience: CatalogAudience }) {
  return (
    <CatalogContent
      audience={audience}
      catalog={await getPublicCatalog(audience)}
    />
  );
}

export function PublicPackagePage({
  audience,
}: {
  audience?: CatalogAudience;
}) {
  const title = audience ? titles[audience] : "Paket guru atau paket sekolah?";
  return (
    <InformationShell title={title}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>PAKET & AKSES</p>
        <h1>{title}</h1>
        <p>
          Lihat penawaran aktif sebelum masuk. Paket guru adalah langganan
          pribadi; paket sekolah dikelola admin sekolah dan tidak otomatis
          menggantikan paket pribadi guru.
        </p>
      </header>
      <div className={styles.grid}>
        <section className={styles.card}>
          <h2>Untuk guru individu</h2>
          <p>
            Guru memilih paket dari akun pribadinya. Perhatikan kredit bulanan,
            bonus, dan hak generator atau ekspor. Kredit bukan jaminan jumlah
            dokumen yang sama untuk semua generator.
          </p>
          <Link prefetch={false} href="/paket/guru">
            Lihat katalog khusus guru →
          </Link>
        </section>
        <section className={styles.card}>
          <h2>Untuk sekolah</h2>
          <p>
            Admin sekolah memilih paket dan periode dari dashboard sekolah.
            Kapasitas guru, siswa, kredit AI, serta fitur mengikuti lisensi.
            Pembelian dan penugasan akses bukan otomatis membuat semua guru
            berlangganan pribadi.
          </p>
          <Link prefetch={false} href="/paket/sekolah">
            Lihat katalog khusus sekolah →
          </Link>
        </section>
      </div>
      {(audience ? [audience] : (["guru", "sekolah"] as const)).map((kind) => (
        <Suspense
          key={kind}
          fallback={
            <p className={styles.notice} role="status">
              Memuat katalog paket {kind}…
            </p>
          }
        >
          <Catalog audience={kind} />
        </Suspense>
      ))}
      <section className={styles.next}>
        <h2>Sebelum berlangganan</h2>
        <p>
          Katalog ini membaca paket aktif yang diatur pengelola. Harga dan
          ketersediaan dapat berubah; periksa kembali ringkasan transaksi di
          dashboard sebelum membayar. Metode pembayaran mengikuti layanan yang
          sudah diaktifkan. Tidak ada pembayaran yang diproses dari halaman ini.
        </p>
        <div className={styles.actions}>
          <a href="/register">Daftar akun guru</a>
          <a href="/untuk-sekolah">Panduan memulai untuk sekolah</a>
          <a href="/bantuan">Bantuan paket dan pembayaran</a>
        </div>
      </section>
    </InformationShell>
  );
}
