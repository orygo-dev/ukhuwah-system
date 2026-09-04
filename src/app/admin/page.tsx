import { AdminShell } from "@/components/layout/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowRight,
  Coins,
  FileText,
  Handshake,
  LayoutTemplate,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Total Pengguna", value: "1,247", icon: Users, change: "+12%" },
  { label: "Generate Bulan Ini", value: "8,432", icon: Sparkles, change: "+28%" },
  { label: "Pendapatan Bulan Ini", value: "Rp 24.5jt", icon: Wallet, change: "+15%" },
  { label: "Dokumen Dibuat", value: "45,891", icon: FileText, change: "+32%" },
];

export default function AdminOverviewPage() {
  return (
    <AdminShell activePath="/admin">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-6 text-white shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-100">Platform Command Center</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
                Overview Super Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/85">
                Pantau aktivitas platform, gateway pembayaran, AI provider, reward,
                afiliasi, dan konfigurasi komersial Navalogi.
              </p>
            </div>
            <Button className="w-fit bg-white text-primary hover:bg-white/90" asChild>
              <Link href="/admin/app-display">
                Atur Tampilan
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="success" className="text-[10px]">
                      {stat.change}
                    </Badge>
                  </div>
                  <p className="mt-3 text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Status Sistem</CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "AI Provider (OpenAI)", status: "Aktif", ok: true },
                { name: "AI Fallback (Claude)", status: "Standby", ok: true },
                { name: "Payment (Midtrans)", status: "Sandbox", ok: true },
                { name: "Payment (Tripay)", status: "Nonaktif", ok: false },
                { name: "Database MySQL", status: "Connected", ok: true },
              ].map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <span className="text-sm">{item.name}</span>
                  <Badge variant={item.ok ? "success" : "secondary"}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Aksi Cepat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/admin/landing-page">
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  Kustomisasi Landing Page
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/admin/ai-settings">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Pengaturan API AI
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/admin/payment-settings">
                  <Wallet className="mr-2 h-4 w-4" />
                  Pengaturan Payment Gateway
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/admin/affiliate">
                  <Handshake className="mr-2 h-4 w-4" />
                  Program Afiliasi
                </Link>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <Link href="/admin/plans">
                  <Coins className="mr-2 h-4 w-4" />
                  Kelola Paket Langganan
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
