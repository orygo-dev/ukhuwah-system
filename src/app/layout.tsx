import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "@livekit/components-styles";
import { APP_NAME } from "@/lib/constants";
import { Providers } from "@/components/providers";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Platform Manajemen Sekolah Yayasan Ukhuwah`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "Platform manajemen sekolah Yayasan Ukhuwah Kalimantan Selatan untuk guru, siswa, dan orang tua di seluruh unit pendidikan Islam terpadu.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecfdf5" },
    { media: "(prefers-color-scheme: dark)", color: "#022c22" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
