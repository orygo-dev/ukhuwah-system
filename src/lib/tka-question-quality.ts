export type TkaQuestionQualityInput = {
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
  stimulus?: string | null;
  prompt: string;
  options: unknown;
  correctAnswers: unknown;
  explanation?: string | null;
  competency?: string | null;
  difficulty?: string | null;
};

function normalizedText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function comparableText(value: unknown) {
  return normalizedText(value).toLocaleLowerCase("id-ID").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function assessTkaQuestionQuality(input: TkaQuestionQualityInput, publicationReady = true) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stimulus = normalizedText(input.stimulus);
  const prompt = normalizedText(input.prompt);
  const explanation = normalizedText(input.explanation);
  const competency = normalizedText(input.competency);
  const options = Array.isArray(input.options) ? input.options.map(normalizedText) : [];
  const answers = Array.isArray(input.correctAnswers)
    ? [...new Set(input.correctAnswers.filter((value): value is number => Number.isInteger(value)))].sort((a, b) => a - b)
    : [];

  if (prompt.length < 12) errors.push("Pertanyaan terlalu pendek untuk dinilai dengan jelas.");
  if (options.length < 3 || options.length > 6) errors.push("Soal TKA harus memiliki 3 sampai 6 opsi jawaban.");
  if (options.some((option) => !option)) errors.push("Setiap opsi jawaban wajib terisi.");
  const distinctOptions = new Set(options.map(comparableText));
  if (distinctOptions.size !== options.length) errors.push("Opsi jawaban tidak boleh sama atau hanya berbeda tanda baca/huruf kapital.");
  if (answers.some((answer) => answer < 0 || answer >= options.length)) errors.push("Kunci jawaban berada di luar jumlah opsi.");
  if (input.type === "SINGLE_CHOICE" && answers.length !== 1) errors.push("Pilihan tunggal harus memiliki tepat satu jawaban benar.");
  if (input.type === "MULTIPLE_CHOICE" && (answers.length < 2 || answers.length >= options.length)) {
    errors.push("Pilihan ganda kompleks harus memiliki minimal dua jawaban benar dan minimal satu pengecoh.");
  }
  if (publicationReady && explanation.length < 20) errors.push("Pembahasan wajib menjelaskan alasan jawaban, bukan hanya menyebut kunci.");
  if (publicationReady && competency.length < 5) errors.push("Kompetensi yang diukur wajib ditulis secara spesifik.");
  if (stimulus && comparableText(stimulus) === comparableText(prompt)) errors.push("Stimulus dan pertanyaan tidak boleh berisi teks yang sama.");

  const contextLength = stimulus.length + prompt.length;
  if (publicationReady && contextLength < 60 && input.difficulty !== "EASY") {
    warnings.push("Konteks soal cukup pendek; pastikan level sedang/sulit benar-benar menguji penerapan atau penalaran.");
  }
  if (publicationReady && !stimulus && input.difficulty === "HARD") {
    warnings.push("Soal sulit tanpa stimulus perlu ditinjau agar tingkat kesulitannya bukan sekadar perhitungan panjang.");
  }
  if (options.some((option) => /^(semua|tidak ada) (jawaban|pilihan) di atas$/i.test(option))) {
    warnings.push("Hindari opsi ‘semua/tidak ada jawaban di atas’ karena dapat memberi petunjuk atau menambah ambiguitas.");
  }

  return { errors, warnings };
}
