"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readResponseJson } from "@/lib/http-json";

type SchoolDocument = { id: string; kind: string; status: string; title: string; content: string; version: number; documentNumber: string | null };
type ScheduleOption = { id: string; name: string };
type DocumentTemplate = { id: string; name: string; kind: string };
type Slot = { classRoomId: string; teacherId: string; subject: string; dayOfWeek: number; periodStart: number; periodEnd: number; room?: string };

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500";

export function SchoolAdministrationClient() {
  const [tab, setTab] = useState<"documents" | "schedule" | "calendar">("documents");
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [classes, setClasses] = useState<ScheduleOption[]>([]);
  const [teachers, setTeachers] = useState<ScheduleOption[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [events, setEvents] = useState<{ id: string; title: string; startsAt: string; endsAt: string }[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/school/administration/documents", { cache: "no-store" });
    const payload = await readResponseJson<{ documents: SchoolDocument[] }>(response);
    if (!response.ok) throw new Error(payload.error || "Gagal memuat dokumen.");
    setDocuments(payload.documents);
  }, []);
  const loadScheduleOptions = useCallback(async () => {
    const response = await fetch("/api/school/administration/schedules", { cache: "no-store" });
    const payload = await readResponseJson<{ classes: ScheduleOption[]; teachers: ScheduleOption[] }>(response);
    if (!response.ok) throw new Error(payload.error || "Gagal memuat data jadwal.");
    setClasses(payload.classes); setTeachers(payload.teachers);
  }, []);
  const loadEvents = useCallback(async () => {
    const response = await fetch("/api/school/administration/calendar", { cache: "no-store" });
    const payload = await readResponseJson<{ events: { id: string; title: string; startsAt: string; endsAt: string }[] }>(response);
    if (!response.ok) throw new Error(payload.error || "Gagal memuat kalender.");
    setEvents(payload.events);
  }, []);
  const loadTemplates = useCallback(async () => {
    const response = await fetch("/api/school/administration/templates", { cache: "no-store" });
    const payload = await readResponseJson<{ templates: DocumentTemplate[] }>(response);
    if (!response.ok) throw new Error(payload.error || "Gagal memuat template.");
    setTemplates(payload.templates);
  }, []);
  useEffect(() => { Promise.all([loadDocuments(), loadScheduleOptions(), loadEvents(), loadTemplates()]).catch((value) => setError(value instanceof Error ? value.message : "Gagal memuat administrasi.")); }, [loadDocuments, loadScheduleOptions, loadEvents, loadTemplates]);

  async function createDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const templateId = String(form.get("templateId") || "");
    const body = { mode: form.get("mode"), kind: form.get("kind"), title: form.get("title"), content: form.get("content"), templateId: templateId || undefined, inputData: { kebutuhan: form.get("notes") } };
    try {
      const response = await fetch("/api/school/administration/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Gagal membuat dokumen.");
      formElement.reset(); setMessage("Draft berhasil dibuat dan belum dianggap dokumen resmi."); await loadDocuments();
    } catch (value) { setError(value instanceof Error ? value.message : "Gagal membuat dokumen."); } finally { setBusy(false); }
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const response = await fetch("/api/school/administration/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.get("name"), kind: form.get("kind"), titleTemplate: form.get("titleTemplate"), contentTemplate: form.get("contentTemplate") }) });
      const payload = await readResponseJson<{ error?: string }>(response); if (!response.ok) throw new Error(payload.error || "Template gagal disimpan.");
      formElement.reset(); await loadTemplates(); setMessage("Template sekolah berhasil disimpan.");
    } catch (value) { setError(value instanceof Error ? value.message : "Template gagal disimpan."); } finally { setBusy(false); }
  }

  async function transition(document: SchoolDocument, action: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/school/administration/documents/${document.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, expectedVersion: document.version }) });
      const payload = await readResponseJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Perubahan status gagal.");
      await loadDocuments();
    } catch (value) { setError(value instanceof Error ? value.message : "Perubahan status gagal."); } finally { setBusy(false); }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/school/administration/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", name: form.get("name"), schoolYear: form.get("schoolYear"), term: form.get("term"), slots }) });
      const payload = await readResponseJson<{ error?: string; conflicts?: { message: string }[] }>(response);
      if (!response.ok) throw new Error(payload.conflicts?.map((item) => item.message).join(" ") || payload.error || "Jadwal gagal disimpan.");
      setSlots([]); formElement.reset(); setMessage("Draft jadwal tersimpan tanpa konflik.");
    } catch (value) { setError(value instanceof Error ? value.message : "Jadwal gagal disimpan."); } finally { setBusy(false); }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const formElement = event.currentTarget; const form = new FormData(formElement);
    try {
      const response = await fetch("/api/school/administration/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), description: form.get("description"), startsAt: new Date(String(form.get("startsAt"))).toISOString(), endsAt: new Date(String(form.get("endsAt"))).toISOString() }) });
      const payload = await readResponseJson<{ error?: string }>(response); if (!response.ok) throw new Error(payload.error || "Agenda gagal disimpan.");
      formElement.reset(); await loadEvents();
    } catch (value) { setError(value instanceof Error ? value.message : "Agenda gagal disimpan."); } finally { setBusy(false); }
  }

  const actions: Record<string, { label: string; action: string } | undefined> = { DRAFT: { label: "Ajukan review", action: "submit" }, IN_REVIEW: { label: "Verifikasi", action: "verify" }, VERIFIED: { label: "Setujui", action: "approve" }, APPROVED: { label: "Arsipkan", action: "archive" } };
  return <div className="space-y-5">
    <div><p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Administrasi sekolah</p><h2 className="text-2xl font-black">Dokumen, jadwal, dan kalender</h2><p className="text-sm text-slate-500">Konten AI selalu dimulai sebagai draft. Publikasi resmi memerlukan review, verifikasi, dan persetujuan.</p></div>
    <div className="flex gap-2">{(["documents", "schedule", "calendar"] as const).map((item) => <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item === "documents" ? "Dokumen" : item === "schedule" ? "Jadwal" : "Kalender"}</Button>)}</div>
    {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}{message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
    {tab === "documents" ? <div className="grid gap-5 lg:grid-cols-[380px_1fr]"><div className="space-y-5"><Card><CardHeader><CardTitle>Buat draft</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={createDocument}><select name="mode" className={inputClass}><option value="manual">Tulis manual</option><option value="ai">Buat draft dengan AI</option></select><select name="kind" className={inputClass}>{["LETTER", "DECREE", "WORK_PROGRAM", "MEETING_MINUTES", "REPORT", "SUPERVISION", "OTHER"].map((kind) => <option key={kind}>{kind}</option>)}</select><select name="templateId" className={inputClass}><option value="">Tanpa template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.kind}</option>)}</select><input required name="title" placeholder="Judul dokumen" className={inputClass}/><textarea name="notes" placeholder="Data/instruksi faktual untuk AI" className={`${inputClass} min-h-24`}/><textarea name="content" placeholder="Isi manual (boleh kosong jika memakai AI/template)" className={`${inputClass} min-h-36`}/><Button disabled={busy} className="w-full">Simpan sebagai draft</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Template sekolah</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={createTemplate}><input required name="name" placeholder="Nama template" className={inputClass}/><select name="kind" className={inputClass}>{["LETTER", "DECREE", "WORK_PROGRAM", "MEETING_MINUTES", "REPORT", "SUPERVISION", "OTHER"].map((kind) => <option key={kind}>{kind}</option>)}</select><input required name="titleTemplate" placeholder="Judul default" className={inputClass}/><textarea required name="contentTemplate" placeholder="Isi template" className={`${inputClass} min-h-28`}/><Button disabled={busy} variant="outline" className="w-full">Simpan template</Button></form></CardContent></Card></div><Card><CardHeader><CardTitle>Daftar dokumen</CardTitle></CardHeader><CardContent className="space-y-3">{documents.map((document) => { const next = actions[document.status]; return <div key={document.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">{document.title}</p><p className="text-xs text-slate-500">{document.kind} · {document.status} · v{document.version}</p></div><div className="flex gap-2">{next ? <Button size="sm" disabled={busy} onClick={() => transition(document, next.action)}>{next.label}</Button> : null}{["APPROVED", "ARCHIVED"].includes(document.status) ? <><Button size="sm" variant="outline" asChild><a href={`/api/school/administration/documents/${document.id}/export?format=pdf`}>PDF</a></Button><Button size="sm" variant="outline" asChild><a href={`/api/school/administration/documents/${document.id}/export?format=docx`}>DOCX</a></Button></> : null}</div></div></div>; })}</CardContent></Card></div> : null}
    {tab === "schedule" ? <Card><CardHeader><CardTitle>Draft jadwal bebas konflik</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={saveSchedule}><div className="grid gap-3 md:grid-cols-3"><input required name="name" placeholder="Nama jadwal" className={inputClass}/><input required name="schoolYear" placeholder="2026/2027" className={inputClass}/><input required name="term" placeholder="Semester 1" className={inputClass}/></div><SlotBuilder classes={classes} teachers={teachers} onAdd={(slot) => setSlots((current) => [...current, slot])}/><div className="space-y-2">{slots.map((slot, index) => <div key={`${slot.classRoomId}-${slot.dayOfWeek}-${slot.periodStart}-${index}`} className="flex justify-between rounded-lg bg-slate-50 p-2 text-sm"><span>Hari {slot.dayOfWeek}, jam {slot.periodStart}-{slot.periodEnd} · {slot.subject}</span><button type="button" className="font-bold text-red-600" onClick={() => setSlots((current) => current.filter((_, item) => item !== index))}>Hapus</button></div>)}</div><Button disabled={busy || slots.length === 0}>Validasi & simpan draft</Button></form></CardContent></Card> : null}
    {tab === "calendar" ? <div className="grid gap-5 md:grid-cols-[380px_1fr]"><Card><CardHeader><CardTitle>Tambah agenda</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={addEvent}><input required name="title" placeholder="Nama agenda" className={inputClass}/><textarea name="description" placeholder="Keterangan" className={inputClass}/><input required type="datetime-local" name="startsAt" className={inputClass}/><input required type="datetime-local" name="endsAt" className={inputClass}/><Button disabled={busy}>Simpan agenda</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Kalender kegiatan</CardTitle></CardHeader><CardContent>{events.map((item) => <div key={item.id} className="border-b py-3"><p className="font-bold">{item.title}</p><p className="text-xs text-slate-500">{new Date(item.startsAt).toLocaleString("id-ID")} – {new Date(item.endsAt).toLocaleString("id-ID")}</p></div>)}</CardContent></Card></div> : null}
  </div>;
}

function SlotBuilder({ classes, teachers, onAdd }: { classes: ScheduleOption[]; teachers: ScheduleOption[]; onAdd: (slot: Slot) => void }) {
  const [slot, setSlot] = useState<Slot>({ classRoomId: "", teacherId: "", subject: "", dayOfWeek: 1, periodStart: 1, periodEnd: 1, room: "" });
  const change = (key: keyof Slot, value: string | number) => setSlot((current) => ({ ...current, [key]: value }));
  const add = () => {
    if (!slot.classRoomId || !slot.teacherId || !slot.subject.trim() || slot.periodEnd < slot.periodStart) return;
    onAdd(slot);
    setSlot((current) => ({ ...current, subject: "", room: "" }));
  };
  return <div className="rounded-xl border bg-slate-50 p-3"><p className="mb-2 text-sm font-bold">Tambah slot</p><div className="grid gap-2 md:grid-cols-4"><select value={slot.classRoomId} onChange={(event) => change("classRoomId", event.target.value)} className={inputClass}><option value="">Pilih kelas</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={slot.teacherId} onChange={(event) => change("teacherId", event.target.value)} className={inputClass}><option value="">Pilih guru</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={slot.subject} onChange={(event) => change("subject", event.target.value)} placeholder="Mata pelajaran" className={inputClass}/><input value={slot.room} onChange={(event) => change("room", event.target.value)} placeholder="Ruang" className={inputClass}/><input type="number" min="1" max="7" value={slot.dayOfWeek} onChange={(event) => change("dayOfWeek", Number(event.target.value))} className={inputClass}/><input type="number" min="1" max="30" value={slot.periodStart} onChange={(event) => change("periodStart", Number(event.target.value))} className={inputClass}/><input type="number" min="1" max="30" value={slot.periodEnd} onChange={(event) => change("periodEnd", Number(event.target.value))} className={inputClass}/><Button type="button" variant="outline" onClick={add}>Tambah slot</Button></div></div>;
}
