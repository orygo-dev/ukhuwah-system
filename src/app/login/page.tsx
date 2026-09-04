import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getAppDisplayConfig, resolveAppName } from "@/lib/app-display";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const config = await getAppDisplayConfig();
  const branding = {
    appName: resolveAppName(config),
    logoUrl: config.branding.logoUrl,
    authLogoUrl: config.branding.authLogoUrl,
    loginTagline: config.branding.loginTagline,
    loginSubtitle: config.branding.loginSubtitle,
  };

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">Memuat...</div>
      }
    >
      <LoginForm branding={branding} />
    </Suspense>
  );
}
