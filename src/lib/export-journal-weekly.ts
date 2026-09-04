import { formatDateId } from "@/lib/daily-journal";
import { journalStatusLabel } from "@/lib/daily-journal";
import type { DocumentStatus } from "@prisma/client";

export type JournalExportRow = {
  date: Date | string;
  mapel: string;
  jamKe: number;
  materi: string;
  kegiatan: string | null;
  evaluasi: string | null;
  refleksi: string | null;
  status: DocumentStatus;
  classRoom: { name: string } | null;
  teacher?: { name: string | null } | null;
};

export function buildWeeklyJournalMarkdown(
  teacherName: string,
  from: string,
  to: string,
  journals: JournalExportRow[]
): string {
  const lines: string[] = [
    `# Rekap Jurnal Mengajar Mingguan`,
    ``,
    `**Guru:** ${teacherName}`,
    `**Periode:** ${formatDateId(from)} — ${formatDateId(to)}`,
    `**Total entri:** ${journals.length}`,
    ``,
    `---`,
    ``,
  ];

  if (journals.length === 0) {
    lines.push(`_Tidak ada jurnal pada periode ini._`);
    return lines.join("\n");
  }

  for (const j of journals) {
    const dateStr = formatDateId(j.date);
    const kelas = j.classRoom?.name ? ` · Kelas ${j.classRoom.name}` : "";
    const jam = j.jamKe > 0 ? ` · Jam ke-${j.jamKe}` : "";
    lines.push(`## ${dateStr} — ${j.mapel}${kelas}${jam}`);
    lines.push(``);
    if (j.teacher?.name && j.teacher.name !== teacherName) {
      lines.push(`**Guru Pengampu:** ${j.teacher.name}`);
      lines.push(``);
    }
    lines.push(`**Status:** ${journalStatusLabel(j.status)}`);
    lines.push(``);
    lines.push(`**Materi:** ${j.materi}`);
    lines.push(``);
    if (j.kegiatan?.trim()) {
      lines.push(`### Kegiatan`);
      lines.push(j.kegiatan.trim());
      lines.push(``);
    }
    if (j.evaluasi?.trim()) {
      lines.push(`### Evaluasi`);
      lines.push(j.evaluasi.trim());
      lines.push(``);
    }
    if (j.refleksi?.trim()) {
      lines.push(`### Refleksi`);
      lines.push(j.refleksi.trim());
      lines.push(``);
    }
    lines.push(`---`);
    lines.push(``);
  }

  return lines.join("\n");
}

export function weekRange(date = new Date()): { from: string; to: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: fmt(mon), to: fmt(sun) };
}
