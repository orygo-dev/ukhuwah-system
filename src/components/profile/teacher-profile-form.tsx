"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
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
import { KURIKULUM_OPTIONS } from "@/lib/constants";
import {
  JENJANG_OPTIONS,
  SEMESTER_OPTIONS,
  getMapelOptions,
} from "@/lib/curriculum";
import {
  PROFILE_FIELD_LABELS,
  PROFILE_SECTIONS,
  currentTahunAjaran,
  type TeacherProfile,
} from "@/lib/teacher-profile";
import { readResponseJson } from "@/lib/http-json";

type TeacherProfileFormProps = {
  required?: boolean;
  returnTo?: string;
};

const EMPTY_PROFILE: TeacherProfile = {
  namaGuru: "",
  nip: "",
  phone: "",
  schoolId: "",
  sekolah: "",
  npsn: "",
  alamatSekolah: "",
  kota: "",
  provinsi: "",
  jenjang: "",
  mapel: "",
  tahunAjaran: currentTahunAjaran(),
  semester: "",
  kurikulum: "",
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

export function TeacherProfileForm({ required, returnTo }: TeacherProfileFormProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<TeacherProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [directory, setDirectory] = useState<SchoolDirectory>(EMPTY_DIRECTORY);
  const [provinceId, setProvinceId] = useState("");
  const [regencyId, setRegencyId] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [profileRes, directoryRes] = await Promise.all([
          fetch("/api/profile", { signal: controller.signal }),
          fetch("/api/school-directory", { signal: controller.signal }),
        ]);
        const profileData = await readResponseJson<{
          profile?: Partial<TeacherProfile>;
          complete?: boolean;
        }>(profileRes);
        const directoryData = await readResponseJson<{
          provinces?: ProvinceOption[];
          regencies?: RegencyOption[];
          schools?: SchoolOption[];
        }>(directoryRes);
        if (!profileRes.ok) throw new Error(profileData.error || "Gagal memuat profil");
        if (!directoryRes.ok) throw new Error(directoryData.error || "Gagal memuat sekolah");

        let nextDirectory: SchoolDirectory = {
          provinces: directoryData.provinces || [],
          regencies: directoryData.regencies || [],
          schools: directoryData.schools || [],
        };
        setDirectory(nextDirectory);

        if (profileData.profile) {
          const nextProfile = { ...EMPTY_PROFILE, ...profileData.profile };
          setProfile(nextProfile);
          setComplete(Boolean(profileData.complete));

          let selectedSchool = nextDirectory.schools.find((school) => school.id === nextProfile.schoolId);
          if (!selectedSchool && nextProfile.schoolId) {
            const exactRes = await fetch(`/api/school-directory?schoolId=${encodeURIComponent(nextProfile.schoolId)}`, { signal: controller.signal });
            const exactData = await readResponseJson<{ schools?: SchoolOption[] }>(exactRes);
            selectedSchool = exactData.schools?.[0];
            if (selectedSchool?.provinceId) {
              const provinceRes = await fetch(`/api/school-directory?provinceId=${encodeURIComponent(selectedSchool.provinceId)}`, { signal: controller.signal });
              const provinceData = await readResponseJson<{ regencies?: RegencyOption[] }>(provinceRes);
              nextDirectory = { ...nextDirectory, regencies: provinceData.regencies || [] };
            }
            if (selectedSchool?.regencyId) {
              const regencyRes = await fetch(`/api/school-directory?regencyId=${encodeURIComponent(selectedSchool.regencyId)}`, { signal: controller.signal });
              const regencyData = await readResponseJson<{ schools?: SchoolOption[] }>(regencyRes);
              nextDirectory = { ...nextDirectory, schools: regencyData.schools || [] };
            }
            if (selectedSchool) nextDirectory = { ...nextDirectory, schools: [...nextDirectory.schools.filter((school) => school.id !== selectedSchool!.id), selectedSchool] };
            setDirectory(nextDirectory);
          }
          if (selectedSchool) {
            setProvinceId(selectedSchool.provinceId || "");
            setRegencyId(selectedSchool.regencyId || "");
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) setError("Gagal memuat profil");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

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

  const setField = (key: keyof TeacherProfile, value: string) => {
    setProfile((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "jenjang") next.mapel = "";
      if (key === "schoolId" && !value) {
        next.sekolah = "";
        next.npsn = "";
        next.alamatSekolah = "";
        next.kota = "";
        next.provinsi = "";
      }
      return next;
    });
    setSaved(false);
  };

  const selectedSchool = useMemo(
    () => directory.schools.find((school) => school.id === profile.schoolId),
    [directory.schools, profile.schoolId]
  );

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

  const selectSchool = (schoolId: string) => {
    const school = directory.schools.find((item) => item.id === schoolId);
    setProfile((prev) => ({
      ...prev,
      schoolId,
      sekolah: school?.name || "",
      npsn: school?.npsn || "",
      alamatSekolah: school?.address || "",
      kota: school?.regencyName || "",
      provinsi: school?.provinceName || "",
    }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await readResponseJson<{
        profile?: Partial<TeacherProfile>;
        complete?: boolean;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan profil");
      }

      setProfile({ ...EMPTY_PROFILE, ...data.profile });
      setComplete(Boolean(data.complete));
      setSaved(true);

      if (data.complete && returnTo) {
        router.push(returnTo);
        router.refresh();
      } else if (data.complete) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan profil");
    } finally {
      setSaving(false);
    }
  };

  const mapelOptions = getMapelOptions(profile.jenjang);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Memuat profil...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {required && !complete && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Lengkapi profil guru terlebih dahulu</p>
            <p className="mt-1 text-amber-800">
              Seperti di Seqolah, Anda perlu mengisi identitas guru, identitas sekolah,
              mata pelajaran mengajar, periode, dan kurikulum sebelum menggunakan
              generator dokumen.
            </p>
          </div>
        </div>
      )}

      {complete && (
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Profil guru sudah lengkap. Data ini akan otomatis terisi di form generator.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {PROFILE_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{section.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {section.id === "sekolah" ? (
              <>
                <div className="space-y-2">
                  <Label>Provinsi</Label>
                  <Select
                    value={provinceId || undefined}
                    onValueChange={(value) => {
                      setProvinceId(value);
                      setRegencyId("");
                      setField("schoolId", "");
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
                      setField("schoolId", "");
                    }}
                    disabled={!provinceId || regencyOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={provinceId ? "Pilih kabupaten/kota" : "Pilih provinsi dulu"}
                      />
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
                  <Label>
                    Sekolah Terdaftar <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    placeholder="Cari nama sekolah atau NPSN..."
                    className="mb-2"
                  />
                  <Select
                    value={profile.schoolId || undefined}
                    onValueChange={selectSchool}
                    disabled={!regencyId || schoolOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          regencyId
                            ? schoolOptions.length
                              ? "Pilih sekolah"
                              : "Sekolah belum tersedia"
                            : "Pilih kabupaten/kota dulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                          {school.npsn ? ` · ${school.npsn}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSchool ? (
                  <div className="rounded-xl border bg-slate-50 p-4 text-sm sm:col-span-2">
                    <p className="font-semibold">{selectedSchool.name}</p>
                    <p className="mt-1 text-muted-foreground">
                      {[
                        selectedSchool.level,
                        selectedSchool.npsn,
                        selectedSchool.regencyName,
                        selectedSchool.provinceName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {selectedSchool.address && (
                      <p className="mt-2 text-muted-foreground">{selectedSchool.address}</p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
                    Sekolah belum dipilih dari master data. Jika sekolah belum tersedia,
                    minta super admin menambahkannya di menu Wilayah & Sekolah.
                  </div>
                )}
              </>
            ) : null}
            {section.fields.map((field) => {
              if (section.id === "sekolah" && field === "schoolId") return null;
              if (section.id === "sekolah" && selectedSchool) return null;
              const label = PROFILE_FIELD_LABELS[field];
              const requiredField = [
                "namaGuru",
                "sekolah",
                "jenjang",
                "mapel",
                "tahunAjaran",
                "semester",
                "kurikulum",
              ].includes(field);

              if (field === "jenjang") {
                return (
                  <div key={field} className="space-y-2">
                    <Label>
                      {label}
                      {requiredField && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select value={profile.jenjang} onValueChange={(v) => setField("jenjang", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenjang" />
                      </SelectTrigger>
                      <SelectContent>
                        {JENJANG_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field === "mapel") {
                return (
                  <div key={field} className="space-y-2">
                    <Label>
                      {label}
                      {requiredField && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select
                      value={profile.mapel}
                      onValueChange={(v) => setField("mapel", v)}
                      disabled={!profile.jenjang}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            profile.jenjang ? "Pilih mata pelajaran" : "Pilih jenjang dulu"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {mapelOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field === "semester") {
                return (
                  <div key={field} className="space-y-2">
                    <Label>
                      {label}
                      {requiredField && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select value={profile.semester} onValueChange={(v) => setField("semester", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih semester" />
                      </SelectTrigger>
                      <SelectContent>
                        {SEMESTER_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field === "kurikulum") {
                return (
                  <div key={field} className="space-y-2 sm:col-span-2">
                    <Label>
                      {label}
                      {requiredField && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select
                      value={profile.kurikulum}
                      onValueChange={(v) => setField("kurikulum", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kurikulum" />
                      </SelectTrigger>
                      <SelectContent>
                        {KURIKULUM_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              const colSpan =
                field === "alamatSekolah" || field === "sekolah" ? "sm:col-span-2" : "";

              return (
                <div key={field} className={`space-y-2 ${colSpan}`}>
                  <Label>
                    {label}
                    {requiredField && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    value={profile[field] || ""}
                    onChange={(e) => setField(field, e.target.value)}
                    placeholder={
                      field === "tahunAjaran"
                        ? "2025/2026"
                        : field === "sekolah"
                          ? "SMP Negeri 1 ..."
                          : undefined
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {saved ? "Tersimpan!" : "Simpan Profil"}
            </>
          )}
        </Button>
        {complete && returnTo && (
          <Button type="button" variant="outline" onClick={() => router.push(returnTo)}>
            Lanjut ke Generator
          </Button>
        )}
      </div>
    </form>
  );
}
