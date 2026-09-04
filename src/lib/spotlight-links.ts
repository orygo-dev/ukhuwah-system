export type SpotlightKind = "teacher" | "student";

export function spotlightPath(kind: SpotlightKind, id: string) {
  return `/spotlight/${kind}/${encodeURIComponent(id)}`;
}

// Only this exact shared-content route may bypass role-specific home routing.
export function isSpotlightSharePath(path: string) {
  return /^\/spotlight\/(teacher|student)\/[a-zA-Z0-9_-]+$/.test(path);
}
