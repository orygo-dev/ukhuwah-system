"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import styles from "./landing-page.module.css";

export function LandingFaq({ appName }: { appName: string }) {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    const openTarget = (hash: string) => {
      const target = Array.from(
        container.current?.querySelectorAll("details") ?? [],
      ).find((item) => `#${item.id}` === hash);
      if (target) {
        target.open = true;
        target.scrollIntoView({ block: "start" });
      }
    };
    const onHash = () => openTarget(window.location.hash);
    // Re-clicking a link to the current hash emits no hashchange. Reopen it anyway.
    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const href =
        event.target instanceof Element
          ? event.target.closest("a")?.getAttribute("href")
          : null;
      if (href?.startsWith("#")) openTarget(href);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return (
    <section
      ref={container}
      id="faq"
      className={styles.faq}
      aria-labelledby="faq-title"
    >
      <h2 id="faq-title">Pertanyaan yang sering diajukan</h2>
      <details id="panduan-siswa">
        <summary>
          Bagaimana siswa mendapatkan akun?
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.answer}>
          Akun siswa disiapkan oleh guru atau pengelola unit sekolah Yayasan
          Ukhuwah. Minta email dan kata sandi akun kepada mereka, lalu gunakan
          akun yang sama untuk masuk ke web atau aplikasi Android {appName}.
          Siswa tidak perlu mendaftar sebagai guru.{" "}
          <Link prefetch={false} href="/panduan/siswa">
            Baca panduan akses siswa
          </Link>
          .
        </div>
      </details>
      <details id="panduan-orangtua">
        <summary>
          Bagaimana orang tua memantau perkembangan anak?
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.answer}>
          Orang tua memakai kode akses yang diberikan guru atau sekolah untuk
          melihat kehadiran, nilai, dan perkembangan putra-putri. Kode ini
          bersifat pribadi dan tidak boleh dibagikan.{" "}
          <Link prefetch={false} href="/orangtua">
            Buka portal orang tua
          </Link>
          .
        </div>
      </details>
      <details id="panduan-sekolah">
        <summary>
          Bagaimana unit sekolah mulai menggunakan {appName}?
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.answer}>
          Gunakan akun admin sekolah yang disiapkan pengelola yayasan. Admin
          sekolah mengelola guru, siswa, dan kegiatan unit pendidikan. Ini
          sistem internal Yayasan Ukhuwah, bukan layanan berlangganan yang
          dibeli secara mandiri.{" "}
          <Link prefetch={false} href="/untuk-sekolah">
            Pelajari langkah penerapan di sekolah
          </Link>
          .
        </div>
      </details>
      <details id="panduan-yayasan">
        <summary>
          Apakah {appName} bisa dipakai sekolah di luar Yayasan Ukhuwah?
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.answer}>
          Tidak. {appName} adalah platform manajemen sekolah milik Yayasan
          Ukhuwah Kalimantan Selatan untuk guru, siswa, dan orang tua di unit
          pendidikan naungan yayasan—dari PAUD hingga SMAIT, termasuk Madrasah
          Tahfizh dan SMPIT HQBS Banjarbaru.{" "}
          <Link prefetch={false} href="/#yayasan">
            Kenali Yayasan Ukhuwah
          </Link>
          .
        </div>
      </details>
    </section>
  );
}
