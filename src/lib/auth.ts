import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { serializeActiveMembershipPlan } from "@/lib/plan-limits";
import {
  clearSecurityRateLimit,
  clientAddress,
  consumeSecurityRateLimit,
} from "@/lib/security-rate-limit";

declare module "next-auth" {
  interface User {
    role: UserRole;
    authVersion: number;
    schoolId?: string | null;
    provinceId?: string | null;
    studentId?: string | null;
    creditsRemaining: number;
    avatarUrl?: string | null;
    membershipPlan?: {
      name: string;
      slug: string;
      expiresAt?: string | null;
      status?: string;
      isActive?: boolean;
    } | null;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      authVersion: number;
      schoolId?: string | null;
      provinceId?: string | null;
      studentId?: string | null;
      creditsRemaining: number;
      avatarUrl?: string | null;
      membershipPlan?: {
        name: string;
        slug: string;
        expiresAt?: string | null;
        status?: string;
        isActive?: boolean;
      } | null;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    authVersion: number;
    schoolId?: string | null;
    provinceId?: string | null;
    studentId?: string | null;
    creditsRemaining: number;
    avatarUrl?: string | null;
    membershipPlan?: {
      name: string;
      slug: string;
      expiresAt?: string | null;
      status?: string;
      isActive?: boolean;
    } | null;
  }
}

const nextAuth = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const suppliedPassword = String(credentials.password);
        const address = clientAddress(request.headers);
        const [addressRate, accountRate] = await Promise.all([
          consumeSecurityRateLimit({
            bucket: "login-ip",
            identity: address,
            limit: 60,
            windowMs: 15 * 60 * 1000,
          }),
          consumeSecurityRateLimit({
            bucket: "login-account",
            identity: `${address}:${email}`,
            limit: 10,
            windowMs: 15 * 60 * 1000,
          }),
        ]);
        if (!addressRate.ok || !accountRate.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            plan: { select: { name: true, slug: true } },
          },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(
          suppliedPassword,
          user.passwordHash
        );
        if (!valid) return null;

        const studentProfile =
          user.role === "STUDENT"
            ? await prisma.student.findFirst({
                where: {
                  userId: user.id,
                  isActive: true,
                  classRoom: { isActive: true },
                },
                select: { id: true },
              })
            : null;

        // Revoked/soft-deleted students must not keep a usable session.
        if (user.role === "STUDENT" && !studentProfile) return null;

        await clearSecurityRateLimit("login-account", `${address}:${email}`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          authVersion: user.authVersion,
          schoolId: user.schoolId,
          provinceId: user.provinceId,
          studentId: studentProfile?.id ?? null,
          creditsRemaining: user.creditsRemaining,
          avatarUrl: user.avatarUrl,
          membershipPlan: serializeActiveMembershipPlan(user.plan, user.planExpiresAt),
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.authVersion = user.authVersion;
        token.schoolId = user.schoolId ?? null;
        token.provinceId = user.provinceId ?? null;
        token.studentId = user.studentId ?? null;
        token.creditsRemaining = user.creditsRemaining;
        token.avatarUrl = user.avatarUrl ?? null;
        token.membershipPlan = user.membershipPlan ?? null;
        return token;
      }

      // /api/auth/session is used directly by Android and SessionProvider.
      // Validate here too, not only in the protected-API auth() wrapper.
      // Returning null makes Auth.js clear stale/chunked cookies and prevents
      // clients from restoring a session that every protected API rejects.
      if (!token.id || !Number.isInteger(token.authVersion)) return null;
      const dbUser = await prisma.user.findUnique({
        where: { id: token.id },
        select: {
          name: true,
          email: true,
          creditsRemaining: true,
          role: true,
          authVersion: true,
          schoolId: true,
          provinceId: true,
          avatarUrl: true,
          planExpiresAt: true,
          plan: { select: { name: true, slug: true } },
        },
      });
      if (!dbUser || dbUser.authVersion !== token.authVersion) return null;
      const studentProfile =
        dbUser.role === "STUDENT"
          ? await prisma.student.findFirst({
              where: {
                userId: token.id,
                isActive: true,
                classRoom: { isActive: true },
              },
              select: { id: true },
            })
          : null;
      if (dbUser.role === "STUDENT" && !studentProfile) return null;
      token.name = dbUser.name;
      token.email = dbUser.email;
      token.creditsRemaining = dbUser.creditsRemaining;
      token.role = dbUser.role;
      // Never promote an existing token to a newer password version,
      // including session updates racing with a password change.
      token.schoolId = dbUser.schoolId;
      token.provinceId = dbUser.provinceId;
      token.studentId = studentProfile?.id ?? null;
      token.avatarUrl = dbUser.avatarUrl;
      token.membershipPlan = serializeActiveMembershipPlan(
        dbUser.plan,
        dbUser.planExpiresAt
      );
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.authVersion = token.authVersion;
        session.user.schoolId = token.schoolId ?? null;
        session.user.provinceId = token.provinceId ?? null;
        session.user.studentId = token.studentId ?? null;
        session.user.creditsRemaining = token.creditsRemaining;
        session.user.avatarUrl = token.avatarUrl ?? null;
        session.user.membershipPlan = token.membershipPlan ?? null;
      }
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * Auth.js verifies the signed cookie; this second check makes authorization
 * reflect current database state and revokes every old session after a
 * password/scope/role change. Legacy tokens without authVersion fail closed.
 */
export async function auth() {
  const session = await nextAuth.auth();
  if (!session?.user?.id || !Number.isInteger(session.user.authVersion)) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      authVersion: true,
      schoolId: true,
      provinceId: true,
      creditsRemaining: true,
      avatarUrl: true,
      planExpiresAt: true,
      plan: { select: { name: true, slug: true } },
    },
  });
  if (!dbUser || dbUser.authVersion !== session.user.authVersion) return null;

  const studentProfile =
    dbUser.role === "STUDENT"
      ? await prisma.student.findFirst({
          where: {
            userId: dbUser.id,
            isActive: true,
            classRoom: { isActive: true },
          },
          select: { id: true },
        })
      : null;
  if (dbUser.role === "STUDENT" && !studentProfile) return null;

  session.user.email = dbUser.email;
  session.user.name = dbUser.name;
  session.user.role = dbUser.role;
  session.user.schoolId = dbUser.schoolId;
  session.user.provinceId = dbUser.provinceId;
  session.user.studentId = studentProfile?.id ?? null;
  session.user.creditsRemaining = dbUser.creditsRemaining;
  session.user.avatarUrl = dbUser.avatarUrl;
  session.user.membershipPlan = serializeActiveMembershipPlan(
    dbUser.plan,
    dbUser.planExpiresAt,
  );
  return session;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return session;
}
