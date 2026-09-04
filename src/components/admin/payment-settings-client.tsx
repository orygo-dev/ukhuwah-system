"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet } from "lucide-react";

type GatewayForm = {
  slug: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
  isSandbox: boolean;
  config: Record<string, string>;
  hasConfig: boolean;
  /** Midtrans/Tripay support live checkout; Flip/iPaymu are config-only for now. */
  checkoutReady: boolean;
};

const PAYMENT_GATEWAY_DEFAULTS: GatewayForm[] = [
  {
    slug: "midtrans",
    name: "Midtrans",
    isActive: false,
    isDefault: false,
    isSandbox: true,
    config: { serverKey: "", clientKey: "" },
    hasConfig: false,
    checkoutReady: true,
  },
  {
    slug: "tripay",
    name: "Tripay",
    isActive: false,
    isDefault: false,
    isSandbox: true,
    config: { apiKey: "", privateKey: "", merchantCode: "" },
    hasConfig: false,
    checkoutReady: true,
  },
  {
    slug: "flip",
    name: "Flip Business",
    isActive: false,
    isDefault: false,
    isSandbox: true,
    config: { apiKey: "", validationToken: "", callbackUrl: "" },
    hasConfig: false,
    checkoutReady: false,
  },
  {
    slug: "ipaymu",
    name: "iPaymu",
    isActive: false,
    isDefault: false,
    isSandbox: true,
    config: { va: "", apiKey: "", callbackUrl: "" },
    hasConfig: false,
    checkoutReady: false,
  },
];

const PAYMENT_METHODS: Record<string, string[]> = {
  midtrans: ["qris", "va", "gopay", "ovo"],
  tripay: ["qris", "va", "ewallet"],
  flip: ["va", "qris", "bank_transfer"],
  ipaymu: ["va", "qris", "ewallet", "retail"],
};

export function AdminPaymentSettingsClient() {
  const [gateways, setGateways] = useState<GatewayForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageOk, setMessageOk] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/payment-gateways");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memuat payment gateway");
      const dbList = data.gateways || [];
      setGateways(
        PAYMENT_GATEWAY_DEFAULTS.map((d) => {
          const db = dbList.find((g: { slug: string }) => g.slug === d.slug);
          if (!db) return d;
          return {
            slug: db.slug,
            name: db.name,
            isActive: db.isActive,
            isDefault: db.isDefault,
            isSandbox: db.isSandbox,
            config: d.config,
            hasConfig: true,
            checkoutReady: d.checkoutReady,
          };
        })
      );
    } catch (event) {
      setMessage(event instanceof Error ? event.message : "Gagal memuat payment gateway");
      setMessageOk(false);
      setGateways(PAYMENT_GATEWAY_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateGw = (slug: string, patch: Partial<GatewayForm>) => {
    setGateways((gws) => gws.map((g) => (g.slug === slug ? { ...g, ...patch } : g)));
  };

  const updateConfig = (slug: string, key: string, value: string) => {
    setGateways((gws) =>
      gws.map((g) =>
        g.slug === slug ? { ...g, config: { ...g.config, [key]: value } } : g
      )
    );
  };

  const handleSave = async (gw: GatewayForm) => {
    setSaving(gw.slug);
    setMessage("");
    setMessageOk(true);
    try {
      const res = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: gw.slug,
          name: gw.name,
          isActive: gw.isActive,
          isDefault: gw.isDefault,
          isSandbox: gw.isSandbox,
          config: gw.config,
          supportedMethods: PAYMENT_METHODS[gw.slug] ?? [],
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Gagal menyimpan payment gateway");
      setMessage(`${gw.name} berhasil disimpan`);
      setMessageOk(true);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Gagal menyimpan");
      setMessageOk(false);
    } finally {
      setSaving(null);
    }
  };

  const setDefault = (slug: string) => {
    setGateways((gws) =>
      gws.map((g) => ({
        ...g,
        isDefault: g.slug === slug,
        isActive: g.slug === slug ? true : g.isActive,
      }))
    );
  };

  if (loading) {
    return (
      <AdminShell activePath="/admin/payment-settings">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell activePath="/admin/payment-settings">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Payment Gateway</h1>
          <p className="text-sm text-muted-foreground">
            Atur gateway pembayaran untuk top up kredit dan langganan. Checkout live saat
            ini hanya Midtrans dan Tripay; Flip/iPaymu dapat dikonfigurasi tetapi belum
            dipakai di alur pembayaran.
          </p>
        </div>

        {gateways.map((gw) => (
          <Card key={gw.slug} className={gw.isDefault ? "border-primary ring-1 ring-primary/20" : ""}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4" />
                {gw.name}
              </CardTitle>
              <div className="flex gap-2">
                {gw.checkoutReady ? (
                  <Badge variant="success">Checkout siap</Badge>
                ) : (
                  <Badge variant="secondary">Config only</Badge>
                )}
                {gw.isDefault && <Badge>Default</Badge>}
                <Badge variant={gw.isActive ? "success" : "secondary"}>
                  {gw.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!gw.checkoutReady ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Gateway ini belum terhubung ke checkout aplikasi (akan mengembalikan
                  HTTP 501 jika dipilih). Simpan konfigurasi untuk persiapan; gunakan
                  Midtrans atau Tripay untuk pembayaran live.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={gw.isActive} onCheckedChange={(v) => updateGw(gw.slug, { isActive: v })} />
                  <Label>Aktif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={gw.isDefault} onCheckedChange={() => setDefault(gw.slug)} />
                  <Label>Default</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={gw.isSandbox} onCheckedChange={(v) => updateGw(gw.slug, { isSandbox: v })} />
                  <Label>Sandbox</Label>
                </div>
              </div>

              {gw.slug === "midtrans" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Server Key</Label>
                    <Input
                      type="password"
                      placeholder={gw.hasConfig ? "••••••••" : "SB-Mid-server-..."}
                      onChange={(e) => updateConfig(gw.slug, "serverKey", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Client Key</Label>
                    <Input
                      type="password"
                      placeholder={gw.hasConfig ? "••••••••" : "SB-Mid-client-..."}
                      onChange={(e) => updateConfig(gw.slug, "clientKey", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {gw.slug === "tripay" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>API Key</Label>
                    <Input type="password" onChange={(e) => updateConfig(gw.slug, "apiKey", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Private Key</Label>
                    <Input type="password" onChange={(e) => updateConfig(gw.slug, "privateKey", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Merchant Code</Label>
                    <Input onChange={(e) => updateConfig(gw.slug, "merchantCode", e.target.value)} />
                  </div>
                </div>
              )}

              {gw.slug === "flip" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Secret Key / API Key</Label>
                    <Input
                      type="password"
                      placeholder={gw.hasConfig ? "••••••••" : "Flip Business secret key"}
                      onChange={(e) => updateConfig(gw.slug, "apiKey", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Validation Token</Label>
                    <Input
                      type="password"
                      placeholder={gw.hasConfig ? "••••••••" : "Token callback Flip"}
                      onChange={(e) => updateConfig(gw.slug, "validationToken", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Callback URL</Label>
                    <Input
                      placeholder="https://domainanda.com/api/payment/flip/callback"
                      onChange={(e) => updateConfig(gw.slug, "callbackUrl", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {gw.slug === "ipaymu" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>VA / Merchant ID</Label>
                    <Input
                      placeholder="Nomor VA iPaymu"
                      onChange={(e) => updateConfig(gw.slug, "va", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      placeholder={gw.hasConfig ? "••••••••" : "API key iPaymu"}
                      onChange={(e) => updateConfig(gw.slug, "apiKey", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Callback URL</Label>
                    <Input
                      placeholder="https://domainanda.com/api/payment/ipaymu/callback"
                      onChange={(e) => updateConfig(gw.slug, "callbackUrl", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Button size="sm" onClick={() => handleSave(gw)} disabled={saving !== null}>
                {saving === gw.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </CardContent>
          </Card>
        ))}

        {message && (
          <p
            className={`rounded-lg border px-4 py-3 text-sm ${
              messageOk
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </AdminShell>
  );
}
