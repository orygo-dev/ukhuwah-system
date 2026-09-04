function pickFirst(values: Array<string | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function requireEnv(
  label: string,
  keys: string[],
  values: Array<string | undefined>
): string {
  const found = pickFirst(values);
  if (!found) {
    throw new Error(`${label} belum dikonfigurasi. Isi ${keys.join(" / ")}.`);
  }
  return found;
}

export function getAuthSecret(): string {
  return requireEnv(
    "Secret auth",
    ["AUTH_SECRET", "NEXTAUTH_SECRET"],
    [process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET]
  );
}

export function getEncryptionSecret(): string {
  return requireEnv(
    "Kunci enkripsi",
    ["ENCRYPTION_KEY", "AUTH_SECRET", "NEXTAUTH_SECRET"],
    [
      process.env.ENCRYPTION_KEY,
      process.env.AUTH_SECRET,
      process.env.NEXTAUTH_SECRET,
    ]
  );
}

export function isSandboxRewardAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SANDBOX_REWARD_ADS === "true"
  );
}
