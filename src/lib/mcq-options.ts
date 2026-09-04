/**
 * Normalize MCQ options: drop blank entries and remap the correct index.
 * Returns null if fewer than 2 options remain or the correct answer was removed.
 */
export function normalizeMcqOptions(
  options: string[],
  correctOptionIndex: number
): { options: string[]; correctOptionIndex: number } | null {
  const kept: Array<{ text: string; originalIndex: number }> = [];
  for (let i = 0; i < options.length; i += 1) {
    const text = options[i]?.trim() ?? "";
    if (text) kept.push({ text, originalIndex: i });
  }
  if (kept.length < 2) return null;
  const remapped = kept.findIndex((item) => item.originalIndex === correctOptionIndex);
  if (remapped < 0) return null;
  return {
    options: kept.map((item) => item.text),
    correctOptionIndex: remapped,
  };
}
