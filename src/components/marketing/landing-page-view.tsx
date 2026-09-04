import {
  ArrowRight,
  BookOpen,
  Building2,
  ChartNoAxesColumnIncreasing,
  ClipboardCheck,
  FilePenLine,
  GraduationCap,
  HeartHandshake,
  Leaf,
  Monitor,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { DEFAULT_BRAND_LOGO_URL } from "@/lib/constants";
import {
  normalizeLandingPage,
  resolveLandingIcon,
  type LandingPageConfig,
} from "@/lib/landing-page.shared";
import {
  DEFAULT_LANDING_EXPERIENCE,
  landingBrand,
  landingHref,
} from "@/lib/landing-experience";
import { LandingNavigation } from "@/components/marketing/landing-navigation";
import {
  ClassroomPreview,
  DashboardPreview,
  DocumentPreviews,
  EditorialShelf,
  LearningMark,
  PhonePreview,
} from "@/components/marketing/landing-previews";
import { LandingFaq } from "@/components/marketing/landing-faq";
import styles from "./landing-page.module.css";

type Props = {
  config: LandingPageConfig;
  branding?: { appName?: string; logoUrl?: string };
};
const stepIcons = [
  FilePenLine,
  BookOpen,
  ClipboardCheck,
  ChartNoAxesColumnIncreasing,
];

const foundationValues = [
  {
    icon: HeartHandshake,
    title: "Berakhlak",
    description:
      "Membentuk adab dan karakter Islami dalam setiap kegiatan belajar di unit pendidikan yayasan.",
  },
  {
    icon: GraduationCap,
    title: "Berprestasi",
    description:
      "Menopang pencapaian akademik, tahfizh, dan karya siswa dari PAUD hingga SMA Islam Terpadu.",
  },
  {
    icon: Leaf,
    title: "Mandiri & berwawasan lingkungan",
    description:
      "Membiasakan kemandirian serta kepedulian lingkungan sesuai arah pendidikan Yayasan Ukhuwah.",
  },
  {
    icon: BookOpen,
    title: "Qur'ani dan terampil",
    description:
      "Menghubungkan pembelajaran, hafalan, dan keterampilan hidup dalam satu ekosistem sekolah.",
  },
] as const;

const educationUnits = [
  "PAUD Islam Terpadu Ukhuwah Banjarmasin",
  "SD Islam Terpadu Ukhuwah dan SDIT Ukhuwah 2",
  "SMP Islam Terpadu Ukhuwah Banjarmasin",
  "SMA Islam Terpadu Ukhuwah Banjarmasin",
  "Madrasah Tahfizh Ukhuwah",
  "SMPIT Hidayatul Quran Boarding School Banjarbaru",
];

export function LandingPageView({ config: rawConfig, branding }: Props) {
  const config = normalizeLandingPage(rawConfig);
  const { hero, features, steps, pricing, cta, header, footer } = config;
  const experience = config.experience ?? DEFAULT_LANDING_EXPERIENCE;
  const { appName, logoUrl } = landingBrand(branding);
  const androidUrl = experience.app.androidUrl.startsWith("https://")
    ? landingHref(experience.app.androidUrl, "/panduan/siswa")
    : "/panduan/siswa";
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#konten">
        Lewati ke konten utama
      </a>
      <LandingNavigation
        appName={appName}
        logoUrl={logoUrl}
        loginLabel={header.loginLabel}
      />
      <main id="konten">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                {hero.badge && (
                  <p className={styles.optionalNote}>{hero.badge}</p>
                )}
                <h1 id="hero-title">
                  {hero.title}
                  <span> {hero.titleHighlight}</span>
                </h1>
                <p>{hero.subtitle}</p>
                <div className={styles.actions}>
                  <Button asChild size="lg">
                    <a href={landingHref(hero.primaryCta.href, "/fitur")}>
                      {hero.primaryCta.label}
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <a href={landingHref(hero.secondaryCta.href, "/aplikasi")}>
                      {hero.secondaryCta.label}
                    </a>
                  </Button>
                </div>
                {hero.trustLine && (
                  <p className={styles.optionalNote}>{hero.trustLine}</p>
                )}
                {hero.stats.length > 0 && (
                  <div className={styles.customStats}>
                    {hero.stats.map((stat, i) => (
                      <div key={i}>
                        <b>{stat.value}</b>
                        <span>{stat.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DashboardPreview appName={appName} />
            </div>
          </div>
        </section>
        <div className={styles.container}>
          <section
            id="fitur"
            className={styles.roles}
            aria-labelledby="roles-title"
          >
            <div className={styles.sectionHeading}>
              <h2 id="roles-title">{features.title}</h2>
              {features.subtitle && <p>{features.subtitle}</p>}
            </div>
            <div className={styles.roleGrid}>
              {features.items.map((role, i) => {
                const Icon = resolveLandingIcon(role.icon);
                return (
                  <div className={styles.role} key={i}>
                    <Icon aria-hidden="true" />
                    <h3>{role.title}</h3>
                    <p>{role.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
          <section className={styles.workflow} aria-labelledby="workflow-title">
            <div className={styles.sectionHeading}>
              <h2 id="workflow-title">{steps.title}</h2>
            </div>
            <div className={styles.stepGrid}>
              {steps.items.map((step, i) => {
                const Icon = stepIcons[i % stepIcons.length];
                return (
                  <div className={styles.step} key={i}>
                    <span className={styles.stepIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                );
              })}
            </div>
            <p>Dari persiapan guru hingga keterlibatan orang tua.</p>
          </section>
          <section className={styles.features} aria-labelledby="features-title">
            <div className={styles.sectionHeading}>
              <h2 id="features-title">{experience.heading}</h2>
            </div>
            <div className={styles.classroomRow}>
              <ClassroomPreview />
              <div className={styles.classroomCopy}>
                <h3>{experience.classroom.title}</h3>
                <p>{experience.classroom.description}</p>
                <a
                  className={styles.textLink}
                  href={landingHref(experience.classroom.link.href)}
                >
                  {experience.classroom.link.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className={styles.editorialGrid}>
              <article className={styles.editorial}>
                <EditorialShelf />
                <h3>{experience.reading.title}</h3>
                <p>{experience.reading.description}</p>
                <a
                  className={styles.editorialLink}
                  href={landingHref(experience.reading.link.href)}
                >
                  {experience.reading.link.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </article>
              <article className={`${styles.editorial} ${styles.spotlight}`}>
                <EditorialShelf spotlight />
                <h3>{experience.spotlight.title}</h3>
                <p>{experience.spotlight.description}</p>
                <a
                  className={styles.editorialLink}
                  href={landingHref(experience.spotlight.link.href)}
                >
                  {experience.spotlight.link.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </article>
            </div>
            <div className={styles.aiBand}>
              <div>
                <h3>{experience.ai.title}</h3>
                <p>{experience.ai.description}</p>
                <a
                  className={styles.textLink}
                  href={landingHref(experience.ai.link.href)}
                >
                  {experience.ai.link.label}
                  <ArrowRight aria-hidden="true" />
                </a>
              </div>
              <DocumentPreviews />
            </div>
          </section>
          <section
            id="yayasan"
            className={styles.marketplace}
            aria-labelledby="yayasan-title"
          >
            <div className={styles.marketplaceIntro}>
              <p className={styles.marketplaceEyebrow}>
                Yayasan Ukhuwah Kalimantan Selatan
              </p>
              <h2 id="yayasan-title">
                Pelopor Sekolah Islam Terpadu di Kalimantan Selatan.
              </h2>
              <p>
                Didirikan pada 26 Oktober 1993 di Banjarmasin, Yayasan Ukhuwah
                menumbuhkan pendidikan berkualitas dan mandiri berbasis konsep
                Islam terpadu. UKHUWAH SYSTEM adalah platform manajemen sekolah
                internal yayasan untuk seluruh unit pendidikan, bukan produk
                langganan publik.
              </p>
            </div>
            <div className={styles.marketplaceGrid}>
              {foundationValues.map(({ icon: Icon, title, description }) => (
                <article key={title} className={styles.marketplaceCard}>
                  <span className={styles.marketplaceIcon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
            <div className={styles.marketplaceHighlight}>
              <div>
                <h3>Unit pendidikan naungan</h3>
                <ul>
                  {educationUnits.map((unit) => (
                    <li key={unit}>{unit}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.marketplaceCtaBox}>
                <p>
                  Visi yayasan: menyelenggarakan pendidikan berkualitas dan
                  mandiri. Sistem ini membantu guru, sekolah, dan orang tua
                  menjalankannya setiap hari.
                </p>
                <div className={styles.actions}>
                  <Button asChild>
                    <a href="/login">Masuk ke sistem</a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href="/fitur">Lihat fitur</a>
                  </Button>
                </div>
              </div>
            </div>
          </section>
          <section
            id="aplikasi"
            className={styles.applications}
            aria-labelledby="app-title"
          >
            <div className={styles.appPhone}>
              <PhonePreview reading={false} />
            </div>
            <div className={styles.appCopy}>
              <h2 id="app-title">{experience.app.title}</h2>
              <div className={styles.platformGrid}>
                <div>
                  <Monitor aria-hidden="true" />
                  <h3>Web untuk pengelolaan</h3>
                  <p>{experience.app.webDescription}</p>
                </div>
                <div>
                  <Smartphone aria-hidden="true" />
                  <h3>Android untuk siswa</h3>
                  <p>{experience.app.androidDescription}</p>
                </div>
              </div>
              <div className={styles.actions}>
                <Button asChild>
                  <a href={androidUrl}>
                    {androidUrl === "/panduan/siswa"
                      ? "Panduan akses siswa"
                      : "Lihat aplikasi siswa"}
                  </a>
                </Button>
              </div>
            </div>
          </section>
          <section
            id="harga"
            className={styles.pricing}
            aria-labelledby="pricing-title"
          >
            <div className={styles.sectionHeading}>
              <h2 id="pricing-title">{pricing.title}</h2>
            </div>
            <div className={styles.pricingGrid}>
              {(
                [
                  ["teacher", UserRound],
                  ["school", Building2],
                  ["parent", UsersRound],
                ] as const
              ).map(([key, Icon]) => {
                const item = experience[key];
                return (
                  <article
                    key={key}
                    id={
                      key === "school"
                        ? "sekolah"
                        : key === "parent"
                          ? "orangtua"
                          : undefined
                    }
                    className={styles.offering}
                  >
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <Button asChild variant="outline">
                        <a href={landingHref(item.link.href)}>
                          {item.link.label}
                        </a>
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p>{pricing.subtitle}</p>
          </section>
          <section
            id="mulai"
            className={styles.start}
            aria-labelledby="start-title"
          >
            <h2 id="start-title">Mulai sesuai peran Anda.</h2>
            <div className={styles.accessGrid}>
              {(
                [
                  [UserRound, "Guru", header.registerLabel, "/register"],
                  [
                    GraduationCap,
                    "Siswa",
                    "Masuk dengan akun dari sekolah",
                    "/login",
                  ],
                  [
                    Building2,
                    "Sekolah",
                    "Pelajari solusi sekolah",
                    "/untuk-sekolah",
                  ],
                  [UsersRound, "Orang tua", "Gunakan kode akses", "/orangtua"],
                ] as const
              ).map(([Icon, title, description, href]) => (
                <a key={title} href={href}>
                  <Icon aria-hidden="true" />
                  <span>
                    <b>{title}</b>
                    <small>{description}</small>
                  </span>
                  <ArrowRight
                    className={styles.accessArrow}
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          </section>
          <LandingFaq appName={appName} />
          <section className={styles.bottomCta} aria-labelledby="cta-title">
            <LearningMark />
            <div>
              <h2 id="cta-title">{cta.title}</h2>
              {cta.subtitle && <p>{cta.subtitle}</p>}
            </div>
            <Button asChild size="lg">
              <a href={landingHref(cta.button.href)}>
                {cta.button.label.replaceAll("{appName}", appName)}
              </a>
            </Button>
          </section>
        </div>
      </main>
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <a
                className={styles.footerBrandLink}
                href="#"
                aria-label={`${appName} — kembali ke atas`}
              >
                <Image
                  src={logoUrl || DEFAULT_BRAND_LOGO_URL}
                  alt={appName}
                  width={220}
                  height={68}
                  unoptimized
                  className={styles.footerLogo}
                />
              </a>
              <p className={styles.footerDesc}>{footer.description}</p>
            </div>
            <div className={styles.footerCol}>
              <h3>Sistem</h3>
              <nav aria-label="Tautan sistem">
                <a href="/fitur">Fitur</a>
                <a href="/#yayasan">Yayasan</a>
                <a href="/aplikasi">Aplikasi</a>
              </nav>
            </div>
            <div className={styles.footerCol}>
              <h3>Untuk</h3>
              <nav aria-label="Tautan audiens">
                <a href="/untuk-sekolah">Sekolah</a>
                <a href="/fitur">Guru</a>
                <a href="/orangtua">Orang tua</a>
              </nav>
            </div>
            <div className={styles.footerCol}>
              <h3>Bantuan</h3>
              <nav aria-label="Tautan bantuan">
                <a href="/bantuan">Pusat bantuan</a>
                <a href="/privacy/siswa">Privasi siswa</a>
                <a href="/privacy/guru">Privasi guru</a>
              </nav>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p className={styles.copyright}>
              © {new Date().getFullYear()} {appName} · Yayasan Ukhuwah
              Kalimantan Selatan.
            </p>
            <nav className={styles.footerLegal} aria-label="Tautan legal">
              <a href="/privacy/siswa">Privasi</a>
              <a href="/bantuan">Bantuan</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
