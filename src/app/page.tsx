import type { Metadata, Viewport } from "next";
import { getLandingPageConfig, getLandingBranding } from "@/lib/landing-page";
import { LandingPageView } from "@/components/marketing/landing-page-view";

export const dynamic = "force-dynamic";

// Scope metadata and accessible zoom to this public page, not existing dashboards.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#22c55e",
};
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getLandingBranding();
  const title = `${branding.appName} — Platform Manajemen Sekolah Yayasan Ukhuwah`;
  const description =
    "Sistem manajemen sekolah, guru, siswa, dan orang tua milik Yayasan Ukhuwah Kalimantan Selatan.";
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: branding.appName,
    },
    appleWebApp: { title: branding.appName },
  };
}

export default async function HomePage() {
  const [config, branding] = await Promise.all([
    getLandingPageConfig(),
    getLandingBranding(),
  ]);

  return <LandingPageView config={config} branding={branding} />;
}
