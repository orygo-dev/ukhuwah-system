import type { Prisma } from "@prisma/client";

export const PRESENCE_WINDOW_MS = 120_000;
export const PRESENCE_POLL_MS = 45_000;
export const PRESENCE_PAGE_SIZE = 50;

export type PresenceViewer = { id: string; role: string; schoolId?: string | null };

export function allowsPresenceOrigin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Native Android does not send Origin.
  try {
    const source = new URL(origin);
    // Apache/TLS termination may give Next an internal HTTP request URL.
    // Match the public host forwarded by the reverse proxy instead of scheme.
    const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
      || request.headers.get("host") || new URL(request.url).host;
    return ["http:", "https:"].includes(source.protocol) && source.host === host;
  } catch { return false; }
}

export function presenceScope(viewer: PresenceViewer): Prisma.StudentWhereInput | null {
  const base: Prisma.StudentWhereInput = { isActive: true, user: { is: { role: "STUDENT" } } };
  if (viewer.role === "SUPER_ADMIN") return { ...base, classRoom: { isActive: true } };
  if (viewer.role === "SCHOOL_ADMIN" && viewer.schoolId) {
    return { ...base, classRoom: { isActive: true, schoolId: viewer.schoolId } };
  }
  if (viewer.role === "TEACHER" && viewer.id) {
    return { ...base, classRoom: { isActive: true, OR: [
      { teacherId: viewer.id },
      { teacherAssignments: { some: { teacherId: viewer.id, isActive: true } } },
    ] } };
  }
  return null;
}

export function presenceStatus(lastSeen: Date | null, now: Date) {
  if (!lastSeen) return "untracked" as const;
  return lastSeen.getTime() >= now.getTime() - PRESENCE_WINDOW_MS && lastSeen <= now
    ? "online" as const : "offline" as const;
}

export type StudentPresenceRow = {
  id: string;
  name: string;
  className: string;
  schoolName: string | null;
  lastSeenAt: string | null;
  status: "online" | "offline" | "untracked";
};

export type StudentPresenceResponse = {
  students: StudentPresenceRow[];
  total: number;
  online: number;
  page: number;
  pageSize: number;
  filteredTotal: number;
  checkedAt: string;
};
