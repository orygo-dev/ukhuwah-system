import { randomUUID } from "crypto";
import { listProvidersForGenerate } from "@/lib/ai/admin-providers";
import { callProviderDetailed, providerHasValidKey } from "@/lib/ai/provider";
import { sortProviders } from "@/lib/ai/status";
import {
  getDailyQuizSettings,
  jakartaDateKey,
  pickThemeForDate,
  type DailyQuizSettings,
} from "@/lib/daily-quiz";
import { prisma } from "@/lib/prisma";

export type GeneratedDailyQuestion = {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
};

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] || trimmed).trim();
}

function parseQuestionsJson(raw: string, expectedCount: number): GeneratedDailyQuestion[] {
  const text = stripCodeFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start < 0 || end <= start) {
      throw new Error("Respons AI bukan JSON soal yang valid.");
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Respons AI harus berupa array soal.");
  }

  const questions: GeneratedDailyQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const prompt = typeof row.prompt === "string" ? row.prompt.trim() : "";
    const options = Array.isArray(row.options)
      ? row.options.map((opt) => String(opt).trim()).filter(Boolean)
      : [];
    const correctOptionIndex = Number(row.correctOptionIndex);
    const explanation =
      typeof row.explanation === "string" ? row.explanation.trim() : undefined;
    if (
      !prompt ||
      options.length < 2 ||
      options.length > 5 ||
      !Number.isInteger(correctOptionIndex) ||
      correctOptionIndex < 0 ||
      correctOptionIndex >= options.length
    ) {
      continue;
    }
    questions.push({
      prompt: prompt.slice(0, 2000),
      options: options.map((opt) => opt.slice(0, 300)),
      correctOptionIndex,
      explanation: explanation?.slice(0, 2000),
    });
    if (questions.length >= expectedCount) break;
  }

  if (questions.length < Math.min(3, expectedCount)) {
    throw new Error("AI menghasilkan terlalu sedikit soal yang valid.");
  }
  return questions.slice(0, expectedCount);
}

function demoQuestions(theme: string, count: number): GeneratedDailyQuestion[] {
  const bank: GeneratedDailyQuestion[] = [
    {
      prompt: `Dalam ${theme}, manakah kebiasaan belajar yang paling efektif?`,
      options: [
        "Mengerjakan soal sedikit demi sedikit setiap hari",
        "Belajar hanya semalam sebelum ujian",
        "Menghafal tanpa memahami konsep",
        "Menyalin jawaban teman",
      ],
      correctOptionIndex: 0,
      explanation: "Latihan rutin membantu pemahaman bertahan lebih lama.",
    },
    {
      prompt: "Apa tujuan utama quiz harian nasional Navalogi?",
      options: [
        "Melatih konsistensi belajar semua siswa Indonesia",
        "Menggantikan seluruh ujian sekolah",
        "Memberi pekerjaan rumah dari guru kelas",
        "Menilai ranking sekolah secara resmi",
      ],
      correctOptionIndex: 0,
      explanation: "Quiz harian bersifat nasional dan mendorong kebiasaan belajar.",
    },
    {
      prompt: "Jika kamu tidak tahu jawaban, sikap terbaik adalah...",
      options: [
        "Menebak secara acak tanpa membaca",
        "Membaca soal dengan teliti lalu memilih opsi paling masuk akal",
        "Melewati semua soal",
        "Menyalin dari internet saat mengerjakan",
      ],
      correctOptionIndex: 1,
      explanation: "Membaca teliti tetap membantu meski belum yakin.",
    },
    {
      prompt: `Topik ${theme} paling dekat dengan kemampuan apa?`,
      options: [
        "Bernalar dan memahami konsep",
        "Hanya menghafal daftar nama",
        "Menghindari soal sulit",
        "Menyalin catatan tanpa dipikirkan",
      ],
      correctOptionIndex: 0,
      explanation: "Fokus quiz adalah bernalar, bukan hafalan kosong.",
    },
    {
      prompt: "Berapa kali siswa boleh mengerjakan quiz harian yang sama?",
      options: ["Satu kali", "Tidak terbatas", "Tiga kali", "Hanya di akhir pekan"],
      correctOptionIndex: 0,
      explanation: "Setiap siswa mendapat satu kesempatan per hari.",
    },
  ];
  const out: GeneratedDailyQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(bank[i % bank.length]!);
  }
  return out;
}

async function generateWithProviders(
  theme: string,
  settings: DailyQuizSettings,
  userId?: string
): Promise<{ questions: GeneratedDailyQuestion[]; providerName: string; usedAi: boolean }> {
  const systemPrompt = [
    "Kamu penulis soal pilihan ganda untuk quiz game harian siswa Indonesia.",
    "Buat soal singkat, jelas, ramah usia SMP-SMA, tanpa konten sensitif.",
    "Jawaban HANYA JSON array valid tanpa markdown.",
    "Setiap item: {\"prompt\":string,\"options\":string[4],\"correctOptionIndex\":number,\"explanation\":string}",
    "correctOptionIndex adalah index 0-based opsi benar.",
  ].join(" ");

  const userPrompt = [
    `Tema/mapel: ${theme}`,
    `Jumlah soal: ${settings.questionCount}`,
    `Level: ${settings.level}`,
    "Cakupan: umum untuk semua siswa Indonesia (nasional), bukan soal kelas tertentu.",
    "Variasikan soal agar tidak terlalu mudah atau terlalu sulit.",
  ].join("\n");

  const providers = sortProviders(
    (await listProvidersForGenerate()).filter((p) => providerHasValidKey(p))
  );
  const requestId = randomUUID();
  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const result = await callProviderDetailed(
        provider,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        undefined,
        userId
          ? {
              requestId,
              userId,
              feature: "daily-quiz",
              toolSlug: "daily-quiz",
              creditCost: 0,
            }
          : undefined
      );
      const questions = parseQuestionsJson(result.content, settings.questionCount);
      return { questions, providerName: provider.name, usedAi: true };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[daily-quiz AI] ${provider.slug}:`, lastError.message);
    }
  }

  if (process.env.DEMO_MODE === "true" || providers.length === 0) {
    return {
      questions: demoQuestions(theme, settings.questionCount),
      providerName: "Demo",
      usedAi: false,
    };
  }

  throw lastError || new Error("Semua provider AI gagal membuat soal quiz harian.");
}

export type CreateDailyQuizInput = {
  dateKey?: string;
  theme?: string;
  title?: string;
  description?: string;
  publish?: boolean;
  createdById?: string;
  questions?: GeneratedDailyQuestion[];
  useAi?: boolean;
};

export async function createOrReplaceDailyQuiz(input: CreateDailyQuizInput) {
  const settings = await getDailyQuizSettings();
  const dateKey = input.dateKey || jakartaDateKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Format tanggal tidak valid (YYYY-MM-DD).");
  }

  const theme =
    (input.theme?.trim() || pickThemeForDate(dateKey, settings.themePool)).slice(0, 120);
  const title =
    (input.title?.trim() || `Quiz Harian · ${theme}`).slice(0, 140);
  const publish = input.publish !== false;

  let questions = input.questions;
  let generatedByAi = false;
  let providerName: string | null = null;

  if (!questions?.length && input.useAi !== false) {
    const generated = await generateWithProviders(theme, settings, input.createdById);
    questions = generated.questions;
    generatedByAi = generated.usedAi;
    providerName = generated.providerName;
  }

  if (!questions?.length) {
    throw new Error("Soal quiz wajib diisi.");
  }

  const existing = await prisma.dailyQuiz.findUnique({
    where: { dateKey },
    select: { id: true, _count: { select: { attempts: true } } },
  });
  if (existing && existing._count.attempts > 0) {
    throw new Error(
      "Quiz tanggal ini sudah dikerjakan siswa dan tidak bisa diganti."
    );
  }

  const data = {
    dateKey,
    title,
    theme,
    description:
      input.description?.trim() ||
      `Quiz game nasional untuk semua siswa · ${dateKey}`,
    status: publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
    questionCount: questions.length,
    generatedByAi,
    createdById: input.createdById || null,
    publishedAt: publish ? new Date() : null,
    questions: {
      create: questions.map((question, index) => ({
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex,
        explanation: question.explanation || null,
        sortOrder: index,
      })),
    },
  };

  const quiz = existing
    ? await prisma.$transaction(async (tx) => {
        await tx.dailyQuizQuestion.deleteMany({ where: { dailyQuizId: existing.id } });
        return tx.dailyQuiz.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            theme: data.theme,
            description: data.description,
            status: data.status,
            questionCount: data.questionCount,
            generatedByAi: data.generatedByAi,
            createdById: data.createdById,
            publishedAt: data.publishedAt,
            questions: data.questions,
          },
          include: {
            questions: { orderBy: { sortOrder: "asc" } },
            _count: { select: { attempts: true, questions: true } },
          },
        });
      })
    : await prisma.dailyQuiz.create({
        data,
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
          _count: { select: { attempts: true, questions: true } },
        },
      });

  return { quiz, providerName, settings };
}
