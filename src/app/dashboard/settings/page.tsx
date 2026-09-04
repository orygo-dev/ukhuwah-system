"use client";

import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { clearDashboardPopupSession } from "@/components/dashboard/dashboard-popup-ad";

export default function SettingsPage() {
  const { data: session } = useSession();
  const handleLogout = async () => {
    clearDashboardPopupSession();
    await signOut({ redirect: false, callbackUrl: "/" });
    window.location.assign("/");
  };

  return (
    <DashboardShell
      activePath="/dashboard/settings"
      user={
        session?.user
          ? {
              name: session.user.name || "",
              email: session.user.email || "",
              credits: session.user.creditsRemaining,
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Pengaturan Profil</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Akun & Keamanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={session?.user?.email || ""} disabled />
            </div>
            <p className="text-sm text-muted-foreground">
              Untuk mengubah identitas guru, sekolah, mapel, periode, dan kurikulum,
              buka halaman{" "}
              <Link href="/dashboard/profil" className="font-medium text-primary hover:underline">
                Profil Guru
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <Card id="reset-password">
          <CardHeader>
            <CardTitle className="text-base">Reset Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Untuk saat ini reset password dilakukan melalui verifikasi OTP WhatsApp
              sesuai pengaturan gateway yang aktif.
            </p>
            <Button variant="outline" disabled>
              Reset Password via OTP
            </Button>
          </CardContent>
        </Card>

        {session?.user?.role === "SUPER_ADMIN" && (
          <Card>
            <CardContent className="p-4">
              <Link href="/admin" className="text-sm font-medium text-primary hover:underline">
                → Buka Panel Super Admin
              </Link>
            </CardContent>
          </Card>
        )}

        <Button variant="outline" onClick={handleLogout}>
          Keluar
        </Button>
      </div>
    </DashboardShell>
  );
}
