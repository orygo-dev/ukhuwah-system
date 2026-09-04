"use client";

import { AppLogo } from "@/components/branding/app-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { cn } from "@/lib/utils";

type MobileDashboardHeaderProps = {
  appName: string;
  logoUrl: string;
};

export function MobileDashboardHeader({
  appName,
  logoUrl,
}: MobileDashboardHeaderProps) {
  return (
    <header className="mobile-app-header sticky top-0 z-30 border-b border-emerald-100 bg-white/[0.97] shadow-[0_8px_24px_rgba(15,76,129,0.08)] backdrop-blur-md lg:hidden">
      <div
        className={cn(
          "flex h-[3.35rem] items-center justify-between gap-3 px-4",
          "pt-[env(safe-area-inset-top,0px)]"
        )}
      >
        <AppLogo
          href="/dashboard"
          appName={appName}
          logoUrl={logoUrl}
          showName={false}
          className="min-w-0"
          imageClassName="h-7 w-auto max-w-[132px] object-contain"
          fallbackClassName="text-[15px] font-bold text-primary"
        />

        <NotificationBell />
      </div>
    </header>
  );
}
