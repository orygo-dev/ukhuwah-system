"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
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

const categories = ["Karya Siswa", "Prestasi", "Literasi", "Kegiatan Kelas"];

type StudentBoardSubmitCardProps = {
  reviewEnabled?: boolean;
};

export function StudentBoardSubmitCard({
  reviewEnabled = true,
}: StudentBoardSubmitCardProps) {
  const [form, setForm] = useState({
    title: "",
    category: "Karya Siswa",
    content: "",
    imageUrl: "",
    visibility: "GLOBAL",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/student/board-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim karya");
      setForm({
        title: "",
        category: "Karya Siswa",
        content: "",
        imageUrl: "",
        visibility: "GLOBAL",
      });
      setMessage(
        data.reviewEnabled === false
          ? "Karya berhasil dikirim dan langsung terbit di mading."
          : "Karya berhasil dikirim dan menunggu review guru."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim karya");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-[24px] border-emerald-100 bg-white shadow-[0_18px_48px_rgba(15,76,129,0.07)]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-extrabold text-slate-950">
            Kirim Karya ke Mading
          </CardTitle>
          <Badge
            className={
              reviewEnabled
                ? "bg-amber-50 text-amber-700 hover:bg-amber-50"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
            }
          >
            {reviewEnabled ? "Direview guru" : "Langsung terbit"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {message ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Contoh: Puisi tentang sekolah"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tampil Untuk</Label>
              <Select
                value={form.visibility}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, visibility: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Publik Navalogi</SelectItem>
                  <SelectItem value="CLASS">Kelas saya</SelectItem>
                  <SelectItem value="SCHOOL">Sekolah saya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL Gambar (opsional)</Label>
              <Input
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((current) => ({ ...current, imageUrl: event.target.value }))
                }
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Isi Karya</Label>
            <Textarea
              value={form.content}
              onChange={(event) =>
                setForm((current) => ({ ...current, content: event.target.value }))
              }
              rows={5}
              placeholder="Tulis karya, cerita kegiatan, atau informasi yang ingin diajukan ke mading."
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Kirim untuk Review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
