"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./landing-page.module.css";

export function LandingBrand({
  appName,
  logoUrl,
}: {
  appName: string;
  logoUrl: string;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  return logoUrl && failedUrl !== logoUrl ? (
    <Image
      src={logoUrl}
      alt={appName}
      width={142}
      height={60}
      unoptimized
      className={styles.logo}
      onError={() => setFailedUrl(logoUrl)}
    />
  ) : (
    <span className={styles.brandName}>{appName}</span>
  );
}

const nav = [
  ["/fitur", "Fitur"],
  ["/#yayasan", "Yayasan"],
  ["/untuk-sekolah", "Sekolah"],
  ["/aplikasi", "Aplikasi"],
  ["/bantuan", "Bantuan"],
];

export function LandingNavigation({
  appName,
  logoUrl,
  loginLabel,
}: {
  appName: string;
  logoUrl: string;
  loginLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className={styles.header}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <div className={styles.headerInner}>
        <Link
          href="/"
          aria-label={`${appName} — beranda`}
          className={styles.brand}
        >
          <LandingBrand appName={appName} logoUrl={logoUrl} />
        </Link>
        <nav aria-label="Navigasi utama" className={styles.desktopNav}>
          {nav.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <Button asChild>
            <Link prefetch={false} href="/login">
              {loginLabel}
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={styles.menuButton}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav
          id="landing-mobile-nav"
          aria-label="Navigasi seluler"
          className={styles.mobileNav}
        >
          {nav.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
