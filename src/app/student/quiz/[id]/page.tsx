import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Kuis kelas diganti quiz harian nasional — satu pintu di /student/quiz */
export default function StudentLegacyQuizRedirectPage() {
  redirect("/student/quiz");
}
