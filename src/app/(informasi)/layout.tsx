import type { Viewport } from "next";
import type { ReactNode } from "react";

// Public guide pages only; no changes to dashboard layout or access controls.
export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#ffffff",
};
export default function InformationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
