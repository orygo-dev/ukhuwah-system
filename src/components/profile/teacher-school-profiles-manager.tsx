"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Save,
  School,
  Star,
  Trash2,
  X,
} from "lucide-react";
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
import {
  JENJANG_OPTIONS,
  SEMESTER_OPTIONS,
  getMapelOptions,
} from "@/lib/curriculum";
import { currentTahunAjaran } from "@/lib/teacher-profile";
import { cn } from "@/lib/utils";
import { readResponseJson } from "@/lib/http-json";

type TeachingProfile = {
  id: string;
  schoolId: string | null;
  schoolName: string;
  npsn: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  jenjang: string;
  mapel: string;
  tahunAjaran: string;
  semester: string;
  isPrimary: boolean;
};

type ProvinceOption = {
  id: string;
  name: string;
};

type RegencyOption = {
  id: string;
  provinceId: string;
  name: string;
  type: string;
};

type SchoolOption = {
  id: string;
  regencyId: string | null;
  name: string;
  npsn: string | null;
  level: string | null;
  address: string | null;
  regencyName: string | null;
  provinceId: string | null;
  provinceName: string | null;
};

type SchoolDirectory = {
  provinces: ProvinceOption[];
  regencies: RegencyOption[];
  schools: SchoolOption[];
};

const EMPTY_DIRECTORY: SchoolDirectory = {
  provinces: [],
  regencies: [],
  schools: [],
};

const EMPTY_FORM = {
  schoolId: "",
  jenjang: "",
  mapel: "",
  tahunAjaran: currentTahunAjaran(),
  semester: "Ganjil",
  isPrimary: false,
};

function jenjangLabel(value: string) {
  return JENJANG_OPTIONS.find((item) => item.value === value)?.label || value;
}

function guessJenjang(level?: string | null) {
  const value = (level || "").toLowerCase();
  if (value.includes("smk")) return "smk";
  if (value.includes("sma") || value.includes("ma")) return "sma";
  if (value.includes("smp") || value.includes("mts")) return "smp";
  if (value.includes("sd") || value.includes("mi")) return "sd";
  return "";
}

export function TeacherSchoolProfilesManager() {
  const [profiles, setProfiles] = useState<TeachingProfile[]>([]);
  const [directory, setDirectory] = useState<SchoolDirectory>(EMPTY_DIRECTORY);
  const [form, setForm] = useState(EMPTY_FORM);
  const [provinceId, setProvinceId] = useState("");
  const [regencyId, setRegencyId] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, directoryRes] = await Promise.all([
        fetch("/api/profile/teaching-profiles"),
        fetch("/api/school-directory"),
      ]);
      const profileData = await readResponseJson<{
        profiles?: TeachingProfile[];
      }>(profileRes);
      const directoryData = await readResponseJson<{
        provinces?: ProvinceOption[];
        regencies?: RegencyOption[];
        schools?: SchoolOption[];
      }>(directoryRes);
      if (!profileRes.ok) throw new Error(profileData.error || "Gagal memuat sekolah mengajar");
      if (!directoryRes.ok) throw new Error(directoryData.error || "Gagal memuat data sekolah");
      setProfiles(profileData.profiles || []);
      setDirectory({
        provinces: directoryData.provinces || [],
        regencies: directoryData.regencies || [],
        schools: directoryData.schools || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat sekolah mengajar");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const regencyOptions = useMemo(
    () =>
      directory.regencies.filter((regency) =>
        provinceId ? regency.provinceId === provinceId : true
      ),
    [directory.regencies, provinceId]
  );

  const schoolOptions = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    return directory.schools.filter((school) => {
      const provinceMatch = provinceId ? school.provinceId === provinceId : true;
      const regencyMatch = regencyId ? school.regencyId === regencyId : true;
      const queryMatch =
        !q ||
        [school.name, school.npsn, school.regencyName, school.provinceName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
      return provinceMatch && regencyMatch && queryMatch;
    });
  }, [directory.schools, provinceId, regencyId, schoolQuery]);

  const mapelOptions = getMapelOptions(form.jenjang);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setProvinceId("");
    setRegencyId("");
    setSchoolQuery("");
    setEditingId(null);
    setShowForm(false);
    setError("");
  };

  const selectSchool = (schoolId: string) => {
    const school = directory.schools.find((item) => item.id === schoolId);
    const guessedJenjang = guessJenjang(school?.level);
    setForm((prev) => ({
      ...prev,
      schoolId,
      jenjang: guessedJenjang || prev.jenjang,
      mapel: guessedJenjang && guessedJenjang !== prev.jenjang ? "" : prev.mapel,
    }));
  };

  const startEdit = (profile: TeachingProfile) => {
    setEditingId(profile.id);
    setShowForm(true);
    setForm({
      schoolId: profile.schoolId || "",
      jenjang: profile.jenjang,
      mapel: profile.mapel,
      tahunAjaran: profile.tahunAjaran,
      semester: profile.semester,
      isPrimary: profile.isPrimary,
    });
    const school = directory.schools.find((item) => item.id === profile.schoolId);
    setProvinceId(school?.provinceId || "");
    setRegencyId(school?.regencyId || "");
    setSchoolQuery(profile.schoolName);
    if (!school && profile.schoolId) void loadSchoolCascade(profile.schoolId);
  };

  const loadSchoolCascade = async (schoolId: string) => {
    try {
      const exactRes = await fetch(`/api/school-directory?schoolId=${encodeURIComponent(schoolId)}`);
      const exact = await readResponseJson<{ schools?: SchoolOption[] }>(exactRes);
      const school = exact.schools?.[0];
      if (!school) return;
      setDirectory((current) => ({ ...current, schools: [...current.schools.filter((item) => item.id !== school.id), school] }));
      if (school.provinceId) setProvinceId(school.provinceId);
      if (school.regencyId) setRegencyId(school.regencyId);
    } catch {
      setError("Gagal memuat lokasi sekolah.");
    }
  };

  useEffect(() => {
    if (!provinceId) return;
    const controller = new AbortController();
    fetch(`/api/school-directory?provinceId=${encodeURIComponent(provinceId)}`, { signal: controller.signal })
      .then((res) => readResponseJson<{ regencies?: RegencyOption[] }>(res))
      .then((data) => { if (!controller.signal.aborted) setDirectory((current) => ({ ...current, regencies: data.regencies || [] })); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [provinceId]);

  useEffect(() => {
    if (!regencyId) return;
    const controller = new AbortController();
    fetch(`/api/school-directory?regencyId=${encodeURIComponent(regencyId)}`, { signal: controller.signal })
      .then((res) => readResponseJson<{ schools?: SchoolOption[] }>(res))
      .then((data) => { if (!controller.signal.aborted) setDirectory((current) => ({ ...current, schools: data.schools || [] })); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [regencyId]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        editingId
          ? `/api/profile/teaching-profiles/${editingId}`
          : "/api/profile/teaching-profiles",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan sekolah mengajar");
      await loadData();
      resetForm();
      setSuccess("Sekolah mengajar berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan sekolah mengajar");
    } finally {
      setSaving(false);
    }
  };

  const markPrimary = async (profile: TeachingProfile) => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/profile/teaching-profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: profile.schoolId,
          jenjang: profile.jenjang,
          mapel: profile.mapel,
          tahunAjaran: profile.tahunAjaran,
          semester: profile.semester,
          isPrimary: true,
        }),
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menjadikan sekolah utama");
      await loadData();
      setSuccess("Sekolah utama berhasil diperbarui.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menjadikan sekolah utama");
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (profile: TeachingProfile) => {
    if (!confirm(`Hapus profil mengajar di ${profile.schoolName}?`)) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/profile/teaching-profiles/${profile.id}`, {
        method: "DELETE",
      });
      const data = await readResponseJson(res);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus sekolah mengajar");
      await loadData();
      setSuccess("Sekolah mengajar berhasil dihapus.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus sekolah mengajar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-emerald-100 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <School className="h-5 w-5 text-emerald-600" />
              Sekolah Mengajar
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola lebih dari satu sekolah. Sekolah utama menjadi default untuk
              dashboard dan generator dokumen.
            </p>
          </div>
          <Button type="button" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="h-4 w-4" />
            Tambah Sekolah
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Memuat sekolah mengajar...
          </div>
        ) : profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-slate-50 p-6 text-center">
            <p className="font-semibold text-slate-900">Belum ada sekolah mengajar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambahkan sekolah utama agar profil guru lengkap dan siap digunakan.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={cn(
                  "rounded-2xl border p-4 transition",
                  profile.isPrimary
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-slate-200 bg-white"
                )}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{profile.schoolName}</h3>
                      {profile.isPrimary && (
                        <Badge className="bg-emerald-600 text-white">Utama</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[profile.npsn, profile.city, profile.province].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{jenjangLabel(profile.jenjang)}</Badge>
                      <Badge variant="secondary">{profile.mapel}</Badge>
                      <Badge variant="secondary">{profile.tahunAjaran}</Badge>
                      <Badge variant="secondary">{profile.semester}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!profile.isPrimary && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => markPrimary(profile)}
                        disabled={saving}
                      >
                        <Star className="h-4 w-4" />
                        Jadikan Utama
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(profile)}
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => deleteProfile(profile)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <form onSubmit={saveProfile} className="rounded-2xl border bg-slate-50 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {editingId ? "Edit Sekolah Mengajar" : "Tambah Sekolah Mengajar"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pilih sekolah dari master data, lalu tentukan jenjang dan mapel.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Provinsi</Label>
                <Select
                  value={provinceId || undefined}
                  onValueChange={(value) => {
                    setProvinceId(value);
                    setRegencyId("");
                    setForm((prev) => ({ ...prev, schoolId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih provinsi" />
                  </SelectTrigger>
                  <SelectContent>
                    {directory.provinces.map((province) => (
                      <SelectItem key={province.id} value={province.id}>
                        {province.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kabupaten/Kota</Label>
                <Select
                  value={regencyId || undefined}
                  onValueChange={(value) => {
                    setRegencyId(value);
                    setForm((prev) => ({ ...prev, schoolId: "" }));
                  }}
                  disabled={!provinceId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kabupaten/kota" />
                  </SelectTrigger>
                  <SelectContent>
                    {regencyOptions.map((regency) => (
                      <SelectItem key={regency.id} value={regency.id}>
                        {regency.type} {regency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Sekolah</Label>
                <Input
                  value={schoolQuery}
                  onChange={(e) => setSchoolQuery(e.target.value)}
                  placeholder="Cari nama sekolah atau NPSN"
                  className="mb-2"
                />
                <Select
                  value={form.schoolId || undefined}
                  onValueChange={selectSchool}
                  disabled={!regencyId || schoolOptions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        regencyId
                          ? schoolOptions.length
                            ? "Pilih sekolah"
                            : "Sekolah tidak ditemukan"
                          : "Pilih kabupaten/kota dulu"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolOptions.slice(0, 100).map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                        {school.npsn ? ` · ${school.npsn}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Jenjang</Label>
                <Select
                  value={form.jenjang || undefined}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, jenjang: value, mapel: "" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenjang" />
                  </SelectTrigger>
                  <SelectContent>
                    {JENJANG_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mata Pelajaran</Label>
                <Select
                  value={form.mapel || undefined}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, mapel: value }))}
                  disabled={!form.jenjang}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih mapel" />
                  </SelectTrigger>
                  <SelectContent>
                    {mapelOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tahun Ajaran</Label>
                <Input
                  value={form.tahunAjaran}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, tahunAjaran: e.target.value }))
                  }
                  placeholder="2026/2027"
                />
              </div>

              <div className="space-y-2">
                <Label>Semester</Label>
                <Select
                  value={form.semester || undefined}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, semester: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTER_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant={form.isPrimary ? "default" : "outline"}
                onClick={() => setForm((prev) => ({ ...prev, isPrimary: !prev.isPrimary }))}
              >
                <Star className="h-4 w-4" />
                {form.isPrimary ? "Akan Jadi Utama" : "Jadikan Utama"}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
