"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Plus, Save, Search, UserCog } from "lucide-react";
import { SchoolSearchPicker } from "@/components/admin/school-search-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

type Role = "SUPER_ADMIN" | "PROVINCE_ADMIN" | "SCHOOL_ADMIN" | "STUDENT" | "TEACHER" | "MERCHANT";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string | null;
  schoolName: string | null;
  provinceId: string | null;
  provinceName: string | null;
  planName: string;
  planSlug: string | null;
  planExpiresAt: string | null;
  creditsRemaining: number;
  walletBalance: number;
  documentsCount: number;
  transactionsCount: number;
  createdAt: string;
};

type SchoolOption = {
  id: string;
  name: string;
  npsn: string | null;
  city: string | null;
  provinceName: string | null;
};

type ProvinceOption = {
  id: string;
  name: string;
};

type AdminUsersClientProps = {
  users: UserRow[];
  schools: SchoolOption[];
  provinces: ProvinceOption[];
  totalUsers: number;
  roleCounts: Record<string, number>;
  totalCredits: number;
  totalWalletBalance: number;
};

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  PROVINCE_ADMIN: "Dinas Provinsi",
  SCHOOL_ADMIN: "Admin Sekolah",
  STUDENT: "Siswa",
  TEACHER: "Guru",
  MERCHANT: "Merchant",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminUsersClient({
  users,
  schools,
  provinces,
  totalUsers,
  roleCounts,
  totalCredits,
  totalWalletBalance,
}: AdminUsersClientProps) {
  const router = useRouter();
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        name: string;
        email: string;
        role: Role;
        schoolId: string;
        provinceId: string;
        password: string;
      }
    >
  >(
    () =>
      Object.fromEntries(
        users.map((user) => [
          user.id,
          {
            name: user.name,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId || "",
            provinceId: user.provinceId || "",
            password: "",
          },
        ])
      )
  );
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "TEACHER" as
      | "TEACHER"
      | "SCHOOL_ADMIN"
      | "PROVINCE_ADMIN"
      | "SUPER_ADMIN",
    schoolId: "",
    provinceId: "",
  });

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesQuery =
        !q ||
        [user.name, user.email, user.schoolName, user.provinceName, user.planName, user.role]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return matchesRole && matchesQuery;
    });
  }, [roleFilter, userQuery, users]);

  const activePremiumUsers = users.filter(
    (user) =>
      user.planSlug &&
      user.planSlug !== "free" &&
      user.planExpiresAt &&
      new Date(user.planExpiresAt).getTime() > Date.now()
  ).length;

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newUser,
          schoolId: newUser.schoolId || null,
          provinceId: newUser.provinceId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat pengguna");
      setNewUser({
        name: "",
        email: "",
        password: "",
        role: "TEACHER",
        schoolId: "",
        provinceId: "",
      });
      setMessage("Pengguna berhasil dibuat.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal membuat pengguna");
    } finally {
      setCreating(false);
    }
  };

  const saveUser = async (user: UserRow) => {
    const draft = drafts[user.id];
    if (!draft || user.role === "SUPER_ADMIN") return;
    setSavingId(user.id);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: draft.role,
          schoolId: draft.schoolId || null,
          provinceId: draft.provinceId || null,
          name: draft.name,
          email: draft.email,
          password: draft.password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui pengguna");
      setMessage("Pengguna berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal memperbarui pengguna");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <p className="text-sm font-bold uppercase tracking-wide text-primary">Akses Platform</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">
          Manajemen Pengguna
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Kelola akun guru, Super Admin, admin sekolah, dan dinas provinsi: ubah role, tautkan
          sekolah/provinsi, edit identitas akun, dan reset password tanpa menyentuh
          database manual.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Pengguna</p>
            <p className="mt-2 text-2xl font-extrabold">{totalUsers}</p>
            <p className="mt-1 text-xs text-muted-foreground">{users.length} akun terbaru tampil</p>
          </CardContent>
        </Card>
        <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Guru</p>
            <p className="mt-2 text-2xl font-extrabold">{roleCounts.TEACHER || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Role pengguna utama</p>
          </CardContent>
        </Card>
        <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Admin Sekolah</p>
            <p className="mt-2 text-2xl font-extrabold">{roleCounts.SCHOOL_ADMIN || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Akses portal sekolah</p>
          </CardContent>
        </Card>
        <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dinas Provinsi</p>
            <p className="mt-2 text-2xl font-extrabold">{roleCounts.PROVINCE_ADMIN || 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">Monitoring read-only</p>
          </CardContent>
        </Card>
        <Card className="rounded-[20px] border-slate-200 bg-white shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Saldo Dompet</p>
            <p className="mt-2 text-2xl font-extrabold">
              {formatCurrency(totalWalletBalance)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalCredits} kredit beredar · {activePremiumUsers} premium aktif
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_16px_45px_rgba(15,76,129,0.06)]">
        <CardHeader className="border-b border-blue-50 bg-emerald-50/45 px-5 py-4">
          <CardTitle className="flex items-center gap-2 text-base font-extrabold text-slate-950">
            <UserCog className="h-5 w-5 text-emerald-600" />
            Tambah Pengguna
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={createUser} className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_190px_auto]">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nama pengguna"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="nama@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                minLength={newUser.role === "SUPER_ADMIN" ? 12 : 8}
                value={newUser.password}
                onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                placeholder={
                  newUser.role === "SUPER_ADMIN"
                    ? "Min. 12 karakter"
                    : "Min. 8 karakter"
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(role: "TEACHER" | "SCHOOL_ADMIN" | "PROVINCE_ADMIN" | "SUPER_ADMIN") =>
                  setNewUser((prev) => ({
                    ...prev,
                    role,
                    schoolId:
                      role === "PROVINCE_ADMIN" || role === "SUPER_ADMIN"
                        ? ""
                        : prev.schoolId,
                    provinceId: role === "PROVINCE_ADMIN" ? prev.provinceId : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEACHER">Guru</SelectItem>
                  <SelectItem value="SCHOOL_ADMIN">Admin Sekolah</SelectItem>
                  <SelectItem value="PROVINCE_ADMIN">Dinas Provinsi</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={creating} className="w-full rounded-xl">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Buat
              </Button>
            </div>
            {newUser.role === "SUPER_ADMIN" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 lg:col-span-5">
                Super Admin memiliki akses penuh ke konfigurasi platform. Gunakan password
                minimal 12 karakter dengan huruf besar, huruf kecil, dan angka. Akun ini tidak
                ditautkan ke sekolah atau provinsi.
              </div>
            ) : newUser.role === "PROVINCE_ADMIN" ? (
              <div className="space-y-2 lg:col-span-5">
                <Label>Provinsi</Label>
                <Select
                  value={newUser.provinceId || undefined}
                  onValueChange={(provinceId) =>
                    setNewUser((prev) => ({ ...prev, provinceId }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih provinsi..." />
                  </SelectTrigger>
                  <SelectContent>
                    {provinces.map((province) => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2 lg:col-span-5">
                <Label>Sekolah</Label>
                <SchoolSearchPicker
                  schools={schools}
                  value={newUser.schoolId}
                  onChange={(schoolId) =>
                    setNewUser((prev) => ({ ...prev, schoolId }))
                  }
                  allowNone
                />
              </div>
            )}
          </form>
          {newUser.role === "SCHOOL_ADMIN" && !newUser.schoolId ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Admin sekolah wajib memilih sekolah agar setelah login langsung masuk ke panel sekolah.
            </p>
          ) : null}
          {newUser.role === "PROVINCE_ADMIN" ? (
            <p className="mt-2 text-xs font-semibold text-emerald-700">
              Akun Dinas Provinsi wajib ditautkan ke satu provinsi agar data sekolah dan monitoring
              tersaring sesuai wilayah.
            </p>
          ) : null}
          {newUser.role === "SUPER_ADMIN" ? (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Setelah dibuat, pemilik akun dapat mengganti password sendiri melalui menu Akun &amp; Keamanan.
            </p>
          ) : null}
          {message ? (
            <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-[24px] border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <CardTitle className="text-base font-extrabold text-slate-950">
            Daftar Pengguna Terbaru
          </CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
              placeholder="Cari nama, email, sekolah, paket, atau role..."
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(value: Role | "ALL") => setRoleFilter(value)}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua role</SelectItem>
              <SelectItem value="TEACHER">Guru</SelectItem>
              <SelectItem value="PROVINCE_ADMIN">Dinas Provinsi</SelectItem>
              <SelectItem value="SCHOOL_ADMIN">Admin Sekolah</SelectItem>
              <SelectItem value="STUDENT">Siswa</SelectItem>
              <SelectItem value="MERCHANT">Merchant</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardContent className="overflow-x-auto p-0">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-semibold text-slate-950">Pengguna tidak ditemukan</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Ubah kata kunci atau filter role untuk melihat pengguna lain.
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[1320px] text-sm">
              <thead>
                <tr className="border-b bg-white text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-bold">Pengguna</th>
                  <th className="px-5 py-3 font-bold">Role</th>
                  <th className="px-5 py-3 font-bold">Sekolah / Provinsi</th>
                  <th className="px-5 py-3 font-bold">Paket</th>
                  <th className="px-5 py-3 font-bold">Kredit</th>
                  <th className="px-5 py-3 font-bold">Dompet</th>
                  <th className="px-5 py-3 font-bold">Aktivitas</th>
                  <th className="px-5 py-3 font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const draft = drafts[user.id] || {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    schoolId: user.schoolId || "",
                    provinceId: user.provinceId || "",
                    password: "",
                  };
                  const isLocked =
                    user.role === "SUPER_ADMIN" || user.role === "STUDENT";
                  const lockReason =
                    user.role === "SUPER_ADMIN"
                      ? "Role Super Admin tidak dapat diubah."
                      : user.role === "STUDENT"
                        ? "Akun siswa dikelola dari data siswa."
                        : "";
                  const planActive =
                    user.planSlug &&
                    user.planSlug !== "free" &&
                    user.planExpiresAt &&
                    new Date(user.planExpiresAt).getTime() > Date.now();

                  return (
                    <tr key={user.id} className="border-b last:border-0">
                          <td className="px-5 py-4">
                        {isLocked ? (
                          <>
                            <p className="font-semibold text-slate-950">{user.name || "Tanpa nama"}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{user.email}</p>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              value={draft.name}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: { ...draft, name: event.target.value },
                                }))
                              }
                              className="h-9 w-[230px]"
                            />
                            <Input
                              type="email"
                              value={draft.email}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: { ...draft, email: event.target.value },
                                }))
                              }
                              className="h-9 w-[230px]"
                            />
                          </div>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Bergabung {formatDate(user.createdAt)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {isLocked ? (
                          <div className="space-y-1">
                            <Badge>{ROLE_LABEL[user.role]}</Badge>
                            {lockReason ? (
                              <p className="max-w-[180px] text-xs leading-5 text-muted-foreground">
                                {lockReason}
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <Select
                            value={draft.role}
                            onValueChange={(role: "TEACHER" | "SCHOOL_ADMIN" | "PROVINCE_ADMIN") =>
                              setDrafts((prev) => ({
                                  ...prev,
                                  [user.id]: {
                                    ...draft,
                                    role,
                                    schoolId:
                                      role === "PROVINCE_ADMIN" ? "" : draft.schoolId,
                                    provinceId:
                                      role === "PROVINCE_ADMIN" ? draft.provinceId : "",
                                  },
                                }))
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TEACHER">Guru</SelectItem>
                              <SelectItem value="SCHOOL_ADMIN">Admin Sekolah</SelectItem>
                              <SelectItem value="PROVINCE_ADMIN">Dinas Provinsi</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {isLocked ? (
                          <p className="max-w-[220px] text-sm text-muted-foreground">
                            {user.role === "PROVINCE_ADMIN"
                              ? user.provinceName || "-"
                              : user.schoolName || "-"}
                          </p>
                        ) : draft.role === "PROVINCE_ADMIN" ? (
                          <Select
                            value={draft.provinceId || undefined}
                            onValueChange={(provinceId) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...draft, provinceId },
                              }))
                            }
                          >
                            <SelectTrigger className="w-[280px]">
                              <SelectValue placeholder="Pilih provinsi..." />
                            </SelectTrigger>
                            <SelectContent>
                              {provinces.map((province) => (
                                <SelectItem key={province.id} value={province.id}>
                                  {province.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <SchoolSearchPicker
                            schools={schools}
                            value={draft.schoolId}
                            onChange={(schoolId) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [user.id]: { ...draft, schoolId },
                              }))
                            }
                            allowNone
                            className="w-[280px]"
                            placeholder="Cari sekolah..."
                          />
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">{user.planName}</p>
                        {planActive ? (
                          <p className="mt-1 text-xs text-emerald-700">
                            Aktif sampai {formatDate(user.planExpiresAt!)}
                          </p>
                        ) : user.planSlug && user.planSlug !== "free" ? (
                          <p className="mt-1 text-xs text-amber-700">Tidak aktif/kedaluwarsa</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Paket dasar</p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-semibold">{user.creditsRemaining}</td>
                      <td className="px-5 py-4 font-semibold">
                        {formatCurrency(user.walletBalance)}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        <p>{user.documentsCount} dokumen</p>
                        <p className="mt-1 text-xs">{user.transactionsCount} transaksi</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-2">
                          {!isLocked ? (
                            <div className="relative">
                              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                              <Input
                                type="password"
                                value={draft.password}
                                onChange={(event) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [user.id]: { ...draft, password: event.target.value },
                                  }))
                                }
                                placeholder="Password baru"
                                className="h-9 w-[180px] pl-8"
                              />
                            </div>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isLocked || savingId === user.id}
                            onClick={() => saveUser(user)}
                          >
                            {savingId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Simpan
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
