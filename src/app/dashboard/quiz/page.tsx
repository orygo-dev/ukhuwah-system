import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Kuis kelas guru dihapus — tugas/PR sudah menutup kebutuhan penilaian kelas. */
export default function QuizPage() {
  redirect("/dashboard/tugas");
}
