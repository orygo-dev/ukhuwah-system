"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { formatDateId, journalStatusLabel } from "@/lib/daily-journal";
import { readResponseJson } from "@/lib/http-json";

type Journal = {
  id: string;
  teacherId: string;
  date: string;
  mapel: string;
  jamKe: number;
  materi: string;
  tujuanPembelajaran: string | null;
  kegiatan: string | null;
  evaluasi: string | null;
  refleksi: string | null;
  tindakLanjut: string | null;
  kendala: string | null;
  status: string;
  classRoom: { id: string; name: string } | null;
};

function Section({
  title,
  content,
}: {
  title: string;
  content: string | null | undefined;
}) {
  if (!content?.trim()) return null;
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-muted-foreground">
        {title}
      </h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
    </div>
  );
}

export function JournalDetailClient({ journalId }: { journalId: string }) {
  const { data: session } = useSession();
  const [journal, setJournal] = useState<Journal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/journals/${journalId}`);
      const data = await readResponseJson<{ journal?: Journal; error?: string }>(res);
      if (res.ok && data.journal) setJournal(data.journal);
      else setError(data.error || "Jurnal tidak ditemukan");
    } catch {
      setError("Gagal memuat detail jurnal.");
    } finally {
      setLoading(false);
    }
  }, [journalId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <DashboardShell activePath="/dashboard/jurnal">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (!journal) {
    return (
      <DashboardShell activePath="/dashboard/jurnal">
        <p className="text-destructive">{error}</p>
        <Button variant="link" asChild className="mt-4 px-0">
          <Link href="/dashboard/jurnal">Kembali</Link>
        </Button>
      </DashboardShell>
    );
  }

  const canEdit = journal.teacherId === session?.user?.id;

  return (
    <DashboardShell
      activePath="/dashboard/jurnal"
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
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link href="/dashboard/jurnal">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Semua Jurnal
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{journal.mapel}</h1>
            <p className="text-muted-foreground">
              {formatDateId(journal.date)}
              {journal.jamKe > 0 ? ` · Jam ke-${journal.jamKe}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">
                {journalStatusLabel(journal.status as "DRAFT" | "FINAL")}
              </Badge>
              {journal.classRoom && (
                <Badge variant="outline">{journal.classRoom.name}</Badge>
              )}
            </div>
          </div>
          {canEdit ? (
            <Button asChild>
              <Link href={`/dashboard/jurnal/${journal.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{journal.materi}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Section title="Tujuan Pembelajaran" content={journal.tujuanPembelajaran} />
            <Section title="Kegiatan Pembelajaran" content={journal.kegiatan} />
            <Section title="Evaluasi" content={journal.evaluasi} />
            <Section title="Refleksi" content={journal.refleksi} />
            <Section title="Tindak Lanjut" content={journal.tindakLanjut} />
            <Section title="Kendala" content={journal.kendala} />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
