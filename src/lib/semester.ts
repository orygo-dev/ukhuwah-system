export type Semester = "Ganjil" | "Genap";

export const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
  { value: "Ganjil", label: "Semester Ganjil" },
  { value: "Genap", label: "Semester Genap" },
];

export function parseSemester(value: string | null | undefined): Semester | null {
  return value === "Ganjil" || value === "Genap" ? value : null;
}

export function parseTahunAjaran(tahunAjaran: string): { startYear: number; endYear: number } {
  const parts = tahunAjaran.split("/").map((p) => Number(p.trim()));
  const startYear = parts[0] || new Date().getFullYear();
  const endYear = parts[1] || startYear + 1;
  return { startYear, endYear };
}

export function semesterDateRange(
  tahunAjaran: string,
  semester: Semester
): { from: string; to: string } {
  const { startYear, endYear } = parseTahunAjaran(tahunAjaran);
  if (semester === "Ganjil") {
    return {
      from: `${startYear}-07-01`,
      to: `${startYear}-12-31`,
    };
  }
  return {
    from: `${endYear}-01-01`,
    to: `${endYear}-06-30`,
  };
}

export function currentSemester(date = new Date()): Semester {
  const month = date.getMonth() + 1;
  return month >= 7 ? "Ganjil" : "Genap";
}

export function semesterLabel(tahunAjaran: string, semester: Semester): string {
  return `${semester} ${tahunAjaran}`;
}
