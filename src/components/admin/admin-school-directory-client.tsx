"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Edit3,
  Loader2,
  MapPinned,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/layout/admin-shell";
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
import { Textarea } from "@/components/ui/textarea";

type ProvinceRow = {
  id: string;
  name: string;
  code: string | null;
  regenciesCount: number;
};

type RegencyRow = {
  id: string;
  provinceId: string;
  provinceName?: string;
  name: string;
  code: string | null;
  type: string;
  schoolsCount: number;
};

type SchoolRow = {
  id: string;
  regencyId: string | null;
  name: string;
  npsn: string | null;
  level: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  regencyName: string | null;
  provinceId: string | null;
  provinceName: string | null;
  usersCount?: number;
  classRoomsCount?: number;
};

type DirectoryPayload = {
  stats?: {
    totalProvinces: number;
    totalRegencies: number;
    totalSchools: number;
    returnedSchools: number;
  };
  provinces: ProvinceRow[];
  regencies: RegencyRow[];
  schools: SchoolRow[];
  bulk?: {
    requested: number;
    deleted: number;
    skipped: { id: string; name: string; reason: string }[];
  };
};

const EMPTY_DATA: DirectoryPayload = {
  stats: {
    totalProvinces: 0,
    totalRegencies: 0,
    totalSchools: 0,
    returnedSchools: 0,
  },
  provinces: [],
  regencies: [],
  schools: [],
};

const EMPTY_PROVINCE = { id: "", name: "", code: "" };
const EMPTY_REGENCY = { id: "", provinceId: "", name: "", code: "", type: "Kabupaten" };
const EMPTY_SCHOOL = { id: "", regencyId: "", name: "", npsn: "", level: "", address: "" };

const SCHOOL_LEVEL_OPTIONS = [
  { value: "SD/MI", label: "SD / MI" },
  { value: "SMP/MTs", label: "SMP / MTs" },
  { value: "SMA/MA", label: "SMA / MA" },
  { value: "SMK/MAK", label: "SMK / MAK" },
];

const PAGE_SIZE = 100;

function isSchoolInUse(school: SchoolRow) {
  return (school.usersCount || 0) + (school.classRoomsCount || 0) > 0;
}

export function AdminSchoolDirectoryClient() {
  const [data, setData] = useState<DirectoryPayload>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provinceForm, setProvinceForm] = useState(EMPTY_PROVINCE);
  const [regencyForm, setRegencyForm] = useState(EMPTY_REGENCY);
  const [schoolForm, setSchoolForm] = useState(EMPTY_SCHOOL);
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [regencyFilter, setRegencyFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const load = async () => {
    setError(null);
    const res = await fetch("/api/admin/school-directory");
    const next = await res.json();
    if (!res.ok) throw new Error(next.error || "Gagal memuat master data");
    setData(next);
  };

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(0);
    setSelectedIds([]);
  }, [provinceFilter, regencyFilter, query]);

  const schoolRegencies = useMemo(() => {
    return data.regencies.filter((item) =>
      provinceFilter === "all" ? true : item.provinceId === provinceFilter
    );
  }, [data.regencies, provinceFilter]);

  const filteredSchools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.schools.filter((school) => {
      const provinceMatch = provinceFilter === "all" || school.provinceId === provinceFilter;
      const regencyMatch = regencyFilter === "all" || school.regencyId === regencyFilter;
      const queryMatch =
        !q ||
        [school.name, school.npsn, school.level, school.regencyName, school.provinceName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return provinceMatch && regencyMatch && queryMatch;
    });
  }, [data.schools, provinceFilter, query, regencyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleSchools = filteredSchools.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );
  const pageSelectableIds = visibleSchools
    .filter((school) => !isSchoolInUse(school))
    .map((school) => school.id);
  const allPageSelected =
    pageSelectableIds.length > 0 &&
    pageSelectableIds.every((id) => selectedIds.includes(id));

  const saveEntity = async (
    entity: "province" | "regency" | "school",
    payload: Record<string, string>,
    isEdit: boolean
  ) => {
    setSaving(entity);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/school-directory", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, ...payload }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "Gagal menyimpan data");
      setData(next);
      setNotice("Data berhasil disimpan");
      if (entity === "province") setProvinceForm(EMPTY_PROVINCE);
      if (entity === "regency") setRegencyForm(EMPTY_REGENCY);
      if (entity === "school") setSchoolForm(EMPTY_SCHOOL);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    } finally {
      setSaving(null);
    }
  };

  const deleteEntity = async (entity: "province" | "regency" | "school", id: string) => {
    if (!window.confirm("Hapus data ini? Tindakan ini tidak bisa dibatalkan.")) return;
    setSaving(`delete-${entity}`);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/school-directory?entity=${entity}&id=${id}`, {
        method: "DELETE",
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "Gagal menghapus data");
      setData(next);
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      setNotice("Data berhasil dihapus");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setSaving(null);
    }
  };

  const toggleSchoolSelection = (school: SchoolRow, checked: boolean) => {
    if (isSchoolInUse(school)) return;
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(school.id) ? prev : [...prev, school.id];
      }
      return prev.filter((id) => id !== school.id);
    });
  };

  const toggleSelectPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        const merged = new Set([...prev, ...pageSelectableIds]);
        return Array.from(merged);
      }
      return prev.filter((id) => !pageSelectableIds.includes(id));
    });
  };

  const bulkDeleteSchools = async () => {
    if (!selectedIds.length) return;
    if (
      !window.confirm(
        `Hapus ${selectedIds.length} sekolah terpilih? Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }
    setSaving("bulk-delete-school");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/school-directory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: "school", ids: selectedIds }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "Gagal menghapus data");
      setData(next);
      setSelectedIds([]);
      const deleted = next.bulk?.deleted ?? 0;
      const skipped = next.bulk?.skipped?.length ?? 0;
      setNotice(
        skipped > 0
          ? `${deleted} sekolah dihapus, ${skipped} dilewati karena masih dipakai.`
          : `${deleted} sekolah berhasil dihapus.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data");
    } finally {
      setSaving(null);
    }
  };

  const editRegency = (regency: RegencyRow) => {
    setRegencyForm({
      id: regency.id,
      provinceId: regency.provinceId,
      name: regency.name,
      code: regency.code || "",
      type: regency.type,
    });
  };

  const editSchool = (school: SchoolRow) => {
    setSchoolForm({
      id: school.id,
      regencyId: school.regencyId || "",
      name: school.name,
      npsn: school.npsn || "",
      level: school.level || "",
      address: school.address || "",
    });
  };

  return (
    <AdminShell activePath="/admin/school-directory">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[22px] border bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white lg:grid-cols-[1fr_360px] lg:p-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                <MapPinned className="h-3.5 w-3.5" />
                Master data sekolah nasional
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Wilayah & Sekolah</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
                Kelola relasi provinsi, kabupaten/kota, dan sekolah agar profil guru,
                dokumen administrasi, serta direktori member memakai data yang konsisten.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/10 p-2 backdrop-blur">
              <Summary
                label="Provinsi"
                value={data.stats?.totalProvinces ?? data.provinces.length}
                tone="dark"
              />
              <Summary
                label="Kab/Kota"
                value={data.stats?.totalRegencies ?? data.regencies.length}
                tone="dark"
              />
              <Summary
                label="Sekolah"
                value={data.stats?.totalSchools ?? data.schools.length}
                tone="dark"
              />
            </div>
          </div>
          <div className="grid gap-3 border-t bg-slate-50 px-6 py-4 text-sm text-slate-600 lg:grid-cols-3 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Data wilayah dipakai sebagai filter profil guru.
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Sekolah terikat langsung ke kabupaten/kota.
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Jenjang sekolah tersimpan di master data.
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border bg-white py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Memuat master data...
          </div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPinned className="h-4 w-4 text-emerald-600" />
                        Provinsi
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Tambahkan provinsi sebagai induk kabupaten/kota.
                      </p>
                    </div>
                    <Badge variant="secondary">{data.provinces.length} data</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                    <div className="space-y-2">
                      <Label>Nama provinsi</Label>
                      <Input
                        value={provinceForm.name}
                        onChange={(e) =>
                          setProvinceForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Jawa Barat"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kode</Label>
                      <Input
                        value={provinceForm.code}
                        onChange={(e) =>
                          setProvinceForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                        placeholder="32"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={saving === "province"}
                      onClick={() =>
                        saveEntity("province", provinceForm, Boolean(provinceForm.id))
                      }
                    >
                      {saving === "province" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : provinceForm.id ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {provinceForm.id ? "Simpan" : "Tambah"}
                    </Button>
                    {provinceForm.id && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProvinceForm(EMPTY_PROVINCE)}
                      >
                        <X className="h-4 w-4" />
                        Batal
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {data.provinces.map((province) => (
                      <div
                        key={province.id}
                        className="flex items-center justify-between rounded-xl border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{province.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {province.code || "Tanpa kode"} · {province.regenciesCount} kab/kota
                          </p>
                        </div>
                        <RowActions
                          onEdit={() =>
                            setProvinceForm({
                              id: province.id,
                              name: province.name,
                              code: province.code || "",
                            })
                          }
                          onDelete={() => deleteEntity("province", province.id)}
                          deleteDisabled={province.regenciesCount > 0}
                        />
                      </div>
                    ))}
                    {!data.provinces.length && (
                      <EmptyState text="Belum ada provinsi. Tambahkan provinsi pertama." />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPinned className="h-4 w-4 text-emerald-600" />
                        Kabupaten/Kota
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Simpan kode wilayah agar data sekolah lebih presisi.
                      </p>
                    </div>
                    <Badge variant="secondary">{data.regencies.length} data</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Provinsi</Label>
                      <Select
                        value={regencyForm.provinceId || undefined}
                        onValueChange={(value) =>
                          setRegencyForm((prev) => ({ ...prev, provinceId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih provinsi" />
                        </SelectTrigger>
                        <SelectContent>
                          {data.provinces.map((province) => (
                            <SelectItem key={province.id} value={province.id}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipe</Label>
                      <Select
                        value={regencyForm.type}
                        onValueChange={(value) =>
                          setRegencyForm((prev) => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kabupaten">Kabupaten</SelectItem>
                          <SelectItem value="Kota">Kota</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nama kabupaten/kota</Label>
                      <Input
                        value={regencyForm.name}
                        onChange={(e) =>
                          setRegencyForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Bandung"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kode</Label>
                      <Input
                        value={regencyForm.code}
                        onChange={(e) =>
                          setRegencyForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                        placeholder="32.04"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={saving === "regency" || !data.provinces.length}
                      onClick={() => saveEntity("regency", regencyForm, Boolean(regencyForm.id))}
                    >
                      {saving === "regency" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : regencyForm.id ? (
                        <Save className="h-4 w-4" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {regencyForm.id ? "Simpan" : "Tambah"}
                    </Button>
                    {regencyForm.id && (
                      <Button type="button" variant="outline" onClick={() => setRegencyForm(EMPTY_REGENCY)}>
                        <X className="h-4 w-4" />
                        Batal
                      </Button>
                    )}
                  </div>

                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {data.regencies.map((regency) => (
                      <div
                        key={regency.id}
                        className="flex items-center justify-between rounded-xl border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">
                            {regency.type} {regency.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {regency.provinceName} · {regency.schoolsCount} sekolah
                          </p>
                        </div>
                        <RowActions
                          onEdit={() => editRegency(regency)}
                          onDelete={() => deleteEntity("regency", regency.id)}
                          deleteDisabled={regency.schoolsCount > 0}
                        />
                      </div>
                    ))}
                    {!data.regencies.length && (
                      <EmptyState text="Belum ada kabupaten/kota." />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="overflow-hidden border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      Sekolah
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Data sekolah yang akan dipilih guru saat melengkapi profil.
                    </p>
                  </div>
                    <Badge variant="secondary">
                      {filteredSchools.length} cocok
                    </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-2xl border bg-slate-50/70 p-4 lg:grid-cols-[220px_1fr_160px_190px]">
                  <div className="space-y-2">
                    <Label>Kabupaten/Kota</Label>
                    <Select
                      value={schoolForm.regencyId || undefined}
                      onValueChange={(value) =>
                        setSchoolForm((prev) => ({ ...prev, regencyId: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kab/kota" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.regencies.map((regency) => (
                          <SelectItem key={regency.id} value={regency.id}>
                            {regency.type} {regency.name} · {regency.provinceName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nama sekolah</Label>
                    <Input
                      value={schoolForm.name}
                      onChange={(e) =>
                        setSchoolForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="SMP Negeri 1 Bandung"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>NPSN</Label>
                    <Input
                      value={schoolForm.npsn}
                      onChange={(e) =>
                        setSchoolForm((prev) => ({ ...prev, npsn: e.target.value }))
                      }
                      placeholder="202XXXXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jenjang</Label>
                    <Select
                      value={schoolForm.level || undefined}
                      onValueChange={(value) =>
                        setSchoolForm((prev) => ({ ...prev, level: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenjang" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCHOOL_LEVEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 lg:col-span-4">
                    <Label>Alamat sekolah</Label>
                    <Textarea
                      value={schoolForm.address}
                      onChange={(e) =>
                        setSchoolForm((prev) => ({ ...prev, address: e.target.value }))
                      }
                      placeholder="Jl. Pendidikan No. 1"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={saving === "school" || !data.regencies.length}
                    onClick={() => saveEntity("school", schoolForm, Boolean(schoolForm.id))}
                  >
                    {saving === "school" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : schoolForm.id ? (
                      <Save className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {schoolForm.id ? "Simpan" : "Tambah Sekolah"}
                  </Button>
                  {schoolForm.id && (
                    <Button type="button" variant="outline" onClick={() => setSchoolForm(EMPTY_SCHOOL)}>
                      <X className="h-4 w-4" />
                      Batal
                    </Button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-[220px_220px_1fr]">
                  <Select
                    value={provinceFilter}
                    onValueChange={(value) => {
                      setProvinceFilter(value);
                      setRegencyFilter("all");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Semua provinsi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua provinsi</SelectItem>
                      {data.provinces.map((province) => (
                        <SelectItem key={province.id} value={province.id}>
                          {province.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={regencyFilter} onValueChange={setRegencyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Semua kab/kota" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua kab/kota</SelectItem>
                      {schoolRegencies.map((regency) => (
                        <SelectItem key={regency.id} value={regency.id}>
                          {regency.type} {regency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="pl-9"
                      placeholder="Cari sekolah, NPSN, kabupaten, atau provinsi..."
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!pageSelectableIds.length}
                    onClick={() => toggleSelectPage(!allPageSelected)}
                  >
                    {allPageSelected ? "Batalkan halaman" : "Pilih halaman"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={!selectedIds.length || saving === "bulk-delete-school"}
                    onClick={() => void bulkDeleteSchools()}
                  >
                    {saving === "bulk-delete-school" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Hapus terpilih ({selectedIds.length})
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Sekolah yang sudah dipakai guru/kelas tidak bisa dipilih.
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50 text-left text-muted-foreground">
                        <th className="w-10 px-4 py-3 font-medium">
                          <input
                            type="checkbox"
                            aria-label="Pilih semua di halaman"
                            checked={allPageSelected}
                            disabled={!pageSelectableIds.length}
                            onChange={(e) => toggleSelectPage(e.target.checked)}
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Sekolah</th>
                        <th className="px-4 py-3 font-medium">Jenjang</th>
                        <th className="px-4 py-3 font-medium">Wilayah</th>
                        <th className="px-4 py-3 font-medium">Penggunaan</th>
                        <th className="px-4 py-3 text-right font-medium">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSchools.map((school) => {
                        const used = isSchoolInUse(school);
                        const selected = selectedIds.includes(school.id);
                        return (
                          <tr key={school.id} className="border-b last:border-0">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                aria-label={`Pilih ${school.name}`}
                                checked={selected}
                                disabled={used}
                                onChange={(e) =>
                                  toggleSchoolSelection(school, e.target.checked)
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium">{school.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {school.npsn || "NPSN belum diisi"}
                              </p>
                              {school.address && (
                                <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                                  {school.address}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary">{school.level || "Belum diisi"}</Badge>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              <p>{school.regencyName || "-"}</p>
                              <p className="text-xs">{school.provinceName || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="secondary">{school.usersCount || 0} guru</Badge>
                                <Badge variant="secondary">
                                  {school.classRoomsCount || 0} kelas
                                </Badge>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <RowActions
                                  onEdit={() => editSchool(school)}
                                  onDelete={() => deleteEntity("school", school.id)}
                                  deleteDisabled={used}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredSchools.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-10">
                            <EmptyState text="Tidak ada sekolah yang cocok dengan filter." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredSchools.length > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Menampilkan {safePage * PAGE_SIZE + 1}–
                      {Math.min((safePage + 1) * PAGE_SIZE, filteredSchools.length)} dari{" "}
                      {filteredSchools.length} sekolah
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 0}
                        onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                      >
                        Sebelumnya
                      </Button>
                      <span className="min-w-24 text-center text-sm text-muted-foreground">
                        Halaman {safePage + 1} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages - 1}
                        onClick={() =>
                          setPage((prev) => Math.min(totalPages - 1, prev + 1))
                        }
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Summary({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: number;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={
        tone === "dark"
          ? "min-w-24 rounded-xl bg-white/10 px-4 py-3 text-center"
          : "min-w-24 rounded-xl bg-slate-50 px-4 py-3 text-center"
      }
    >
      <p className="text-xl font-bold">{value}</p>
      <p className={tone === "dark" ? "text-xs text-emerald-100" : "text-xs text-muted-foreground"}>
        {label}
      </p>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" size="icon" variant="ghost" onClick={onEdit} aria-label="Edit">
        <Edit3 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={onDelete}
        disabled={deleteDisabled}
        aria-label="Hapus"
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
