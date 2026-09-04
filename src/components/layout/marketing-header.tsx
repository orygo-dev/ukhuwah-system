import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { AppLogo } from "@/components/branding/app-logo";
import { Button } from "@/components/ui/button";
import type { LandingPageConfig } from "@/lib/landing-page";
import type { AppBranding } from "@/lib/app-display";

type MarketingHeaderProps = {
  header?: LandingPageConfig["header"];
  branding?: AppBranding;
};

export function MarketingHeader({ header, branding }: MarketingHeaderProps) {
  const loginLabel = header?.loginLabel ?? "Masuk";
  const registerLabel = header?.registerLabel ?? "Daftar akun guru";
  const appName = branding?.appName || APP_NAME;

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-100 bg-white/[0.96] shadow-[0_8px_30px_rgba(5,150,105,0.08)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <AppLogo
          href="/"
          appName={appName}
          logoUrl={branding?.logoUrl}
          showName={false}
          imageClassName="h-10 w-auto max-w-[170px] object-contain"
          fallbackClassName="grid h-10 w-10 place-items-center rounded-xl gradient-brand text-sm font-black text-white shadow-md shadow-emerald-600/20"
        />

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="#fitur"
            className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-950"
          >
            Fitur
          </Link>
          <Link
            href="/#yayasan"
            className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-950"
          >
            Yayasan
          </Link>
          <Link
            href="#faq"
            className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-950"
          >
            FAQ
          </Link>
          <Link
            href="/orangtua"
            className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-950"
          >
            Portal Orang Tua
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/login">{loginLabel}</Link>
          </Button>
          <Button variant="brand" asChild>
            <Link href="/register">{registerLabel}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
