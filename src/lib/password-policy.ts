import { z } from "zod";

export const strongAdminPasswordSchema = z
  .string()
  .min(12, "Password baru minimal 12 karakter")
  .max(128, "Password baru maksimal 128 karakter")
  .regex(/[a-z]/, "Password wajib memiliki huruf kecil")
  .regex(/[A-Z]/, "Password wajib memiliki huruf besar")
  .regex(/[0-9]/, "Password wajib memiliki angka");

export function isLegacyDemoPassword(password: string) {
  return password === "admin123456" || password === "guru123456";
}
