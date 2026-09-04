import { prisma } from "@/lib/prisma";

export const DAILY_QUIZ_SETTING_KEY = "daily_quiz";
export const JAKARTA_TZ = "Asia/Jakarta";

export type DailyQuizSettings = {
  questionCount: number;
  themePool: string[];
  level: string;
};

export const DEFAULT_DAILY_QUIZ_SETTINGS: DailyQuizSettings = {
  questionCount: 5,
  themePool: [
    "Matematika",
    "IPA",
    "IPS",
    "Bahasa Indonesia",
    "Pendidikan Pancasila",
    "Bahasa Inggris",
    "Literasi Digital",
  ],
  level: "Campuran LOTS & HOTS",
};

export function jakartaDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatJakartaDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  const utc = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: JAKARTA_TZ,
  }).format(utc);
}

function normalizeThemePool(value: unknown): string[] {
  if (!Array.isArray(value)) return [...DEFAULT_DAILY_QUIZ_SETTINGS.themePool];
  const themes = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  return themes.length > 0 ? Array.from(new Set(themes)) : [...DEFAULT_DAILY_QUIZ_SETTINGS.themePool];
}

export function mergeDailyQuizSettings(value: unknown): DailyQuizSettings {
  if (!value || typeof value !== "object") {
    return {
      ...DEFAULT_DAILY_QUIZ_SETTINGS,
      themePool: [...DEFAULT_DAILY_QUIZ_SETTINGS.themePool],
    };
  }
  const raw = value as Partial<DailyQuizSettings>;
  const count = Number(raw.questionCount);
  return {
    questionCount:
      Number.isFinite(count) && count >= 3 && count <= 15
        ? Math.round(count)
        : DEFAULT_DAILY_QUIZ_SETTINGS.questionCount,
    themePool: normalizeThemePool(raw.themePool),
    level:
      typeof raw.level === "string" && raw.level.trim()
        ? raw.level.trim().slice(0, 80)
        : DEFAULT_DAILY_QUIZ_SETTINGS.level,
  };
}

export async function getDailyQuizSettings(): Promise<DailyQuizSettings> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: DAILY_QUIZ_SETTING_KEY },
    select: { value: true },
  });
  return mergeDailyQuizSettings(setting?.value);
}

export async function upsertDailyQuizSettings(
  input: DailyQuizSettings
): Promise<DailyQuizSettings> {
  const next = mergeDailyQuizSettings(input);
  await prisma.platformSetting.upsert({
    where: { key: DAILY_QUIZ_SETTING_KEY },
    create: { key: DAILY_QUIZ_SETTING_KEY, value: next },
    update: { value: next },
  });
  return next;
}

export function pickThemeForDate(
  dateKey: string,
  themePool: string[]
): string {
  const pool =
    themePool.length > 0 ? themePool : DEFAULT_DAILY_QUIZ_SETTINGS.themePool;
  const seed = dateKey
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return pool[seed % pool.length]!;
}

export function computeDailyQuizXp(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  const base = correctCount * 20;
  const perfectBonus = correctCount === totalQuestions ? 50 : 0;
  return base + perfectBonus;
}

export async function getPublishedDailyQuizByDate(dateKey: string) {
  return prisma.dailyQuiz.findFirst({
    where: { dateKey, status: "PUBLISHED" },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { attempts: true, questions: true } },
    },
  });
}

export async function countStudentDailyStreak(studentId: string): Promise<number> {
  const attempts = await prisma.dailyQuizAttempt.findMany({
    where: { studentId },
    select: { dailyQuiz: { select: { dateKey: true } } },
    orderBy: { submittedAt: "desc" },
    take: 60,
  });
  const done = new Set(attempts.map((item) => item.dailyQuiz.dateKey));
  const cursor = new Date();
  if (!done.has(jakartaDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const key = jakartaDateKey(cursor);
    if (!done.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
