import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getLandingBranding, getLandingPageConfig } from "@/lib/landing-page";
import { landingHref } from "@/lib/landing-experience";
import {
  LANDING_INFORMATION,
  type InformationKey,
  type InformationPage,
} from "@/lib/landing-information";
import { LandingNavigation } from "./landing-navigation";
import landingStyles from "./landing-page.module.css";
import styles from "./information-page.module.css";

export async function informationMetadata(
  key: InformationKey,
): Promise<Metadata> {
  const brand = await getLandingBranding();
  const page = LANDING_INFORMATION[key];
  return {
    title: { absolute: `${page.eyebrow} — ${brand.appName}` },
    description: page.description,
  };
}

export async function InformationShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const [brand, config] = await Promise.all([
    getLandingBranding(),
    getLandingPageConfig(),
  ]);
  return (
    <div className={landingStyles.page}>
      <a className={landingStyles.skipLink} href="#konten">
        Lewati ke konten utama
      </a>
      <LandingNavigation {...brand} loginLabel={config.header.loginLabel} />
      <main id="konten" className={styles.main}>
        <nav aria-label="Jejak halaman" className={styles.breadcrumb}>
          <Link prefetch={false} href="/">
            Beranda
          </Link>
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </nav>
        {children}
      </main>
      <footer className={styles.footer}>
        <div>
          <p>
            {brand.appName} · {config.footer.description}
          </p>
          <nav aria-label="Tautan bantuan">
            <a href="/bantuan">Bantuan</a>
            <a href="/privacy/siswa">Privasi siswa</a>
            <a href="/privacy/guru">Privasi guru</a>
            <Link prefetch={false} href="/">
              Beranda
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function InformationContent({
  page,
  androidUrl,
}: {
  page: InformationPage;
  androidUrl?: string;
}) {
  const download = androidUrl?.startsWith("https://")
    ? landingHref(androidUrl, "")
    : "";
  return (
    <>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>{page.eyebrow}</p>
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </header>
      <div className={styles.grid}>
        {page.sections.map((section) => (
          <section className={styles.card} key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
            {section.points && (
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
            {section.steps && (
              <ol>
                {section.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
            {section.link && (
              <a href={section.link.href}>{section.link.label} →</a>
            )}
          </section>
        ))}
      </div>
      {androidUrl !== undefined && (
        <section className={styles.next} aria-label="Tautan Android resmi">
          <h2>Aplikasi Android siswa</h2>
          {download ? (
            <div className={styles.actions}>
              <a href={download}>Buka tautan Android resmi</a>
            </div>
          ) : (
            <p>
              Tautan unduh resmi belum dicantumkan pengelola. Minta tautan
              aplikasi kepada guru atau sekolah. Anda tetap dapat masuk melalui
              web dengan akun siswa yang sama.
            </p>
          )}
        </section>
      )}
      <section className={styles.next} aria-label="Langkah berikutnya">
        <h2>Langkah berikutnya</h2>
        <div className={styles.actions}>
          {page.next.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

export async function PublicInformationPage({
  pageKey,
}: {
  pageKey: InformationKey;
}) {
  const page = LANDING_INFORMATION[pageKey];
  const config = pageKey === "aplikasi" ? await getLandingPageConfig() : null;
  return (
    <InformationShell title={page.eyebrow}>
      <InformationContent
        page={page}
        androidUrl={config?.experience?.app.androidUrl}
      />
    </InformationShell>
  );
}
