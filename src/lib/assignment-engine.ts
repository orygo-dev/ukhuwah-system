import { z } from "zod";

export const ASSIGNMENT_QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "SHORT_ANSWER",
  "ESSAY",
] as const;

export type AssignmentQuestionTypeValue = (typeof ASSIGNMENT_QUESTION_TYPES)[number];

export function distributeAssignmentPoints(count: number, total = 100) {
  if (!Number.isInteger(count) || count < 1 || count > 100) return [];
  const unit = Math.floor((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? Number((total - unit * (count - 1)).toFixed(2)) : unit,
  );
}

export const assignmentOptionSchema = z.object({
  text: z.string().trim().max(1000).default(""),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
}).refine((option) => Boolean(option.text || option.imageUrl), "Pilihan wajib berisi teks atau gambar");

export type AssignmentOption = z.infer<typeof assignmentOptionSchema>;

const assignmentOptionDraftSchema = z.union([
  z.string().trim().max(1000),
  z.object({ text: z.string().trim().max(1000).default(""), imageUrl: z.string().trim().max(1000).nullable().optional() }),
]);

export const assignmentQuestionDraftSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.enum(ASSIGNMENT_QUESTION_TYPES),
  prompt: z.string().trim().max(5000),
  imageUrl: z.string().trim().max(1000).nullable().optional(),
  options: z.array(assignmentOptionDraftSchema).max(10).optional(),
  correctAnswer: z.unknown().optional(),
  points: z.coerce.number().positive("Bobot soal harus lebih dari 0").max(1000),
  required: z.boolean().default(true),
  explanation: z.string().trim().max(4000).optional(),
});

export const assignmentQuestionInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    type: z.enum(ASSIGNMENT_QUESTION_TYPES),
    prompt: z.string().trim().min(1, "Pertanyaan wajib diisi").max(5000),
    imageUrl: z.string().trim().max(1000).nullable().optional(),
    options: z.array(assignmentOptionDraftSchema).max(10).optional(),
    correctAnswer: z.unknown().optional(),
    points: z.coerce.number().positive("Bobot soal harus lebih dari 0").max(1000),
    required: z.boolean().default(true),
    explanation: z.string().trim().max(4000).optional(),
  })
  .superRefine((question, ctx) => {
    const options = question.type === "TRUE_FALSE"
      ? [{ text: "Benar", imageUrl: null }, { text: "Salah", imageUrl: null }]
      : normalizeAssignmentOptions(question.options);
    if (["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(question.type)) {
      if (!options || options.length < 2 || options.some((option) => !option.text && !option.imageUrl)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Soal pilihan wajib memiliki minimal 2 opsi", path: ["options"] });
      }
    }
    if (question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE") {
      if (!Number.isInteger(question.correctAnswer)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kunci jawaban pilihan tunggal wajib dipilih", path: ["correctAnswer"] });
      } else if (!options || Number(question.correctAnswer) < 0 || Number(question.correctAnswer) >= options.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Kunci jawaban berada di luar opsi", path: ["correctAnswer"] });
      }
    }
    if (question.type === "MULTIPLE_CHOICE") {
      const indexes = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
      if (!indexes.length || indexes.some((value) => !Number.isInteger(value) || Number(value) < 0 || Number(value) >= (options?.length ?? 0))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Pilih minimal satu kunci jawaban yang valid", path: ["correctAnswer"] });
      }
    }
    if (question.type === "SHORT_ANSWER") {
      const accepted = Array.isArray(question.correctAnswer)
        ? question.correctAnswer
        : [question.correctAnswer];
      if (!accepted.some((value) => typeof value === "string" && value.trim())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Jawaban singkat wajib memiliki kunci", path: ["correctAnswer"] });
      }
    }
  });

export type AssignmentQuestionInput = z.infer<typeof assignmentQuestionInputSchema>;

export type StoredAssignmentQuestion = {
  id: string;
  type: AssignmentQuestionTypeValue;
  prompt: string;
  imageUrl?: string | null;
  options: unknown;
  correctAnswer: unknown;
  points: number;
  required: boolean;
};

export type AssignmentAnswerInput = { questionId: string; response?: unknown };

export function normalizeAssignmentOption(value: unknown): AssignmentOption {
  if (typeof value === "string") return { text: value, imageUrl: null };
  if (value && typeof value === "object") {
    const option = value as { text?: unknown; imageUrl?: unknown };
    return {
      text: typeof option.text === "string" ? option.text : "",
      imageUrl: typeof option.imageUrl === "string" && option.imageUrl ? option.imageUrl : null,
    };
  }
  return { text: "", imageUrl: null };
}

export function normalizeAssignmentOptions(value: unknown): AssignmentOption[] {
  return Array.isArray(value) ? value.map(normalizeAssignmentOption) : [];
}

function normalizedText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function normalizedIndexes(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
}

export function hasAssignmentResponse(type: AssignmentQuestionTypeValue, value: unknown) {
  if (type === "MULTIPLE_CHOICE") return normalizedIndexes(value).length > 0;
  if (type === "SINGLE_CHOICE" || type === "TRUE_FALSE") {
    return value !== null && value !== undefined && value !== "" && Number.isInteger(Number(value));
  }
  return normalizedText(value).length > 0;
}

export function gradeAssignmentResponse(question: StoredAssignmentQuestion, response: unknown) {
  if (question.type === "ESSAY") {
    return { autoGraded: false, score: null as number | null };
  }
  let correct = false;
  if (question.type === "SINGLE_CHOICE" || question.type === "TRUE_FALSE") {
    correct = Number(response) === Number(question.correctAnswer);
  } else if (question.type === "MULTIPLE_CHOICE") {
    const actual = normalizedIndexes(response);
    const expected = normalizedIndexes(question.correctAnswer);
    correct = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  } else {
    const accepted = (Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer])
      .map(normalizedText)
      .filter(Boolean);
    correct = accepted.includes(normalizedText(response));
  }
  return { autoGraded: true, score: correct ? question.points : 0 };
}

export function gradeStructuredAssignment(
  questions: StoredAssignmentQuestion[],
  inputAnswers: AssignmentAnswerInput[]
) {
  const byQuestion = new Map(inputAnswers.map((answer) => [answer.questionId, answer.response]));
  const missingRequired = questions
    .filter((question) => question.required && !hasAssignmentResponse(question.type, byQuestion.get(question.id)))
    .map((question) => question.id);
  const answers = questions
    .filter((question) => hasAssignmentResponse(question.type, byQuestion.get(question.id)))
    .map((question) => {
      const response = byQuestion.get(question.id);
      return { questionId: question.id, response, ...gradeAssignmentResponse(question, response) };
    });
  const autoScore = answers.reduce((sum, answer) => sum + (answer.score ?? 0), 0);
  const fullyAutoGraded = questions.length > 0 && questions.every((question) => question.type !== "ESSAY");
  return { answers, autoScore, fullyAutoGraded, missingRequired };
}

export function publicAssignmentQuestion(question: StoredAssignmentQuestion & { explanation?: string | null }) {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    imageUrl: question.imageUrl ?? null,
    options: question.type === "TRUE_FALSE"
      ? [{ text: "Benar", imageUrl: null }, { text: "Salah", imageUrl: null }]
      : normalizeAssignmentOptions(question.options),
    points: question.points,
    required: question.required,
  };
}

export function canRevealAssignmentSolutions(input: {
  status?: string | null;
  allowResubmit: boolean;
  answers: Array<{ autoGraded: boolean }>;
}) {
  if (input.status !== "GRADED") return false;
  const retryableAutoGrade = input.allowResubmit && input.answers.length > 0 && input.answers.every((answer) => answer.autoGraded);
  return !retryableAutoGrade;
}
