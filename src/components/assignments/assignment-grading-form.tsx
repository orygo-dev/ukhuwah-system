"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  assignmentId: string;
  submissionId: string;
  initialScore: number | null;
  initialFeedback: string | null;
  initialVersion: number;
  maxScore: number;
  answers?: Array<{ id: string; prompt: string; maxScore: number; initialScore: number | null; initialFeedback: string | null }>;
};

export function AssignmentGradingForm({
  assignmentId,
  submissionId,
  initialScore,
  initialFeedback,
  initialVersion,
  maxScore,
  answers = [],
}: Props) {
  const router = useRouter();
  const [score, setScore] = useState(initialScore?.toString() ?? "");
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [version, setVersion] = useState(initialVersion);
  const [answerGrades, setAnswerGrades] = useState(() => Object.fromEntries(answers.map((answer) => [answer.id, { score: answer.initialScore?.toString() ?? "", feedback: answer.initialFeedback ?? "" }])));

  const submitGrade = async (event: React.SyntheticEvent, action: "GRADE" | "RETURN" = "GRADE") => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/submissions/${submissionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            score: action === "GRADE" ? score : undefined,
            feedback,
            version,
            answerScores: action === "GRADE" ? answers.flatMap((answer) => {
              const grade = answerGrades[answer.id];
              return grade?.score === "" ? [] : [{ answerId: answer.id, score: Number(grade.score), feedback: grade.feedback }];
            }) : undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nilai");
      setScore(String(data.submission.score ?? ""));
      setFeedback(data.submission.feedback ?? "");
      setVersion(data.submission.version);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nilai");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submitGrade}
      className="mt-4 grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 md:grid-cols-[120px_1fr_auto]"
    >
      {answers.length ? (
        <div className="space-y-3 md:col-span-3">
          <Label className="text-xs font-black text-slate-700">Nilai per soal</Label>
          {answers.map((answer, index) => (
            <div key={answer.id} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[1fr_110px_1fr]">
              <p className="text-xs font-bold leading-5 text-slate-700">{index + 1}. {answer.prompt}</p>
              <Input type="number" min="0" max={answer.maxScore} step="0.1" value={answerGrades[answer.id]?.score ?? ""} placeholder={`0-${answer.maxScore}`} onChange={(event) => setAnswerGrades((current) => ({ ...current, [answer.id]: { ...current[answer.id], score: event.target.value } }))} />
              <Input value={answerGrades[answer.id]?.feedback ?? ""} placeholder="Feedback butir" onChange={(event) => setAnswerGrades((current) => ({ ...current, [answer.id]: { ...current[answer.id], feedback: event.target.value } }))} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-600">Nilai</Label>
        <Input
          type="number"
          min="0"
          max={maxScore}
          step="0.1"
          value={score}
          onChange={(event) => setScore(event.target.value)}
          placeholder={`0-${maxScore}`}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-bold text-slate-600">Feedback</Label>
        <Textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Catatan singkat untuk siswa"
          rows={2}
        />
      </div>
      <div className="flex items-end">
        <div className="flex gap-2">
        <Button type="submit" disabled={saving} className="w-full md:w-auto">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saved ? "Tersimpan" : "Simpan"}
        </Button>
        <Button type="button" variant="outline" disabled={saving || !feedback.trim()} onClick={(event) => submitGrade(event, "RETURN")} className="w-full md:w-auto">Kembalikan</Button>
        </div>
      </div>
      {error ? (
        <p className="text-sm font-medium text-red-600 md:col-span-3">{error}</p>
      ) : null}
    </form>
  );
}
