import Link from "next/link";
import { AppLogo } from "@/components/branding/app-logo";
import { APP_NAME } from "@/lib/constants";
import type { LandingPageConfig } from "@/lib/landing-page";
import type { AppBranding } from "@/lib/app-display";

type MarketingFooterProps = {
  footer?: LandingPageConfig["footer"];
  branding?: AppBranding;
};

export function MarketingFooter({ footer, branding }: MarketingFooterProps) {
  const description =
    footer?.description ??
    "Platform manajemen sekolah milik Yayasan Ukhuwah Kalimantan Selatan.";
  const appName = branding?.appName || APP_NAME;
  const footerLogoUrl = branding?.authLogoUrl || branding?.logoUrl || "";

  return (
    <footer className="border-t bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <AppLogo
              appName={appName}
              logoUrl={footerLogoUrl}
              showName={false}
              className="mb-4"
              imageClassName="h-10 w-auto max-w-[170px] object-contain"
              fallbackClassName="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-sm font-black text-white"
            />
            <p className="max-w-sm text-sm text-slate-400">
              {description}
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Sistem</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/#fitur" className="hover:text-white">
                  Fitur
                </Link>
              </li>
              <li>
                <Link href="/#yayasan" className="hover:text-white">
                  Yayasan
                </Link>
              </li>
              <li>
                <Link href="/orangtua" className="hover:text-white">
                  Portal Orang Tua
                </Link>
              </li>
              <li>
                <Link href="/untuk-sekolah" className="hover:text-white">
                  Sekolah
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/privacy/siswa" className="hover:text-white">
                  Privasi Siswa
                </Link>
              </li>
              <li>
                <Link href="/privacy/guru" className="hover:text-white">
                  Privasi Guru
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white">
                  Syarat & Ketentuan
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} {appName} · Yayasan Ukhuwah Kalimantan
          Selatan.
        </div>
      </div>
    </footer>
  );
}
