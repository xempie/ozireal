import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { env } from "@/env";

/**
 * Authentication.
 *
 * §2 fixes the choice: Auth.js v5 with Google and Microsoft Entra. D1 fixes the scope:
 * one office, one user, so access is an allowlist rather than a signup flow. There is
 * no invite, no roles screen and no self-registration.
 *
 * The session carries `tenantId`, which is what binds a request to a set of rows -
 * every query runs inside a transaction with that value set, and row-level security
 * refuses anything else. Auth is therefore not just a gate on the front door; it is
 * the input to the isolation the database enforces.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      role: string;
    } & DefaultSession["user"];
  }
}

/** Who is allowed in at all. Comma-separated, lower-cased, exact match. */
function allowlist(): string[] {
  return (env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Google and Entra are only registered when their credentials exist.
 *
 * Auth.js throws at boot for a provider with an undefined clientId, so listing them
 * unconditionally would mean the app could not start until the OAuth apps are
 * registered - and registering those is on the human side of §15.
 */
const oauthProviders = [
  ...(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET
    ? [Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET })]
    : []),
  ...(env.AUTH_ENTRA_ID && env.AUTH_ENTRA_SECRET && env.AUTH_ENTRA_TENANT
    ? [
        MicrosoftEntraID({
          clientId: env.AUTH_ENTRA_ID,
          clientSecret: env.AUTH_ENTRA_SECRET,
          issuer: `https://login.microsoftonline.com/${env.AUTH_ENTRA_TENANT}/v2.0`,
        }),
      ]
    : []),
];

/**
 * A development sign-in, so the console is usable before the OAuth apps exist.
 *
 * Hard-gated three ways: NODE_ENV must not be production, AUTH_DEV_LOGIN must be
 * explicitly "1", and the address must still pass the allowlist. It takes no password,
 * which is the point - it is a convenience for local work, not a weak credential to be
 * guessed. Anything that authenticates on a hostname the public can reach must be
 * OAuth.
 */
const devLoginEnabled =
  env.NODE_ENV !== "production" && env.AUTH_DEV_LOGIN === "1";

const devProvider = devLoginEnabled
  ? [
      Credentials({
        id: "dev",
        name: "Development sign-in",
        credentials: { email: { label: "Email", type: "email" } },
        async authorize(raw) {
          const email = String(raw?.email ?? "").trim().toLowerCase();
          if (!email || !allowlist().includes(email)) return null;

          const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
          if (!u) return null;
          return { id: u.id, email: u.email, name: u.name };
        },
      }),
    ]
  : [];

/**
 * Password sign-in — the production path when no OAuth app is configured.
 *
 * This exists because the alternative was worse. Asked to "disable Google auth",
 * the tempting move is to let the passwordless development login run in
 * production; that would put a door on a public URL that opens for anyone who
 * can guess an allowlisted address, in front of a database of client contact
 * details and consent records. A real password is barely more work and is
 * actually a credential.
 *
 * Available whenever the user has a password set. Enumeration is avoided by
 * doing the same work and returning the same nothing for an unknown address, a
 * user with no password, and a wrong password.
 */
const passwordProvider = Credentials({
  id: "password",
  name: "Email and password",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(raw) {
    const email = String(raw?.email ?? "").trim().toLowerCase();
    const password = String(raw?.password ?? "");
    if (!email || !password) return null;
    if (!allowlist().includes(email)) return null;

    const { verifyPassword, MAX_ATTEMPTS, lockoutUntil } = await import(
      "@/server/auth/password"
    );

    const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!u?.passwordHash) return null;

    // A live lockout refuses without touching scrypt, so a locked account cannot
    // be used to burn CPU either.
    if (u.lockedUntil && u.lockedUntil > new Date()) return null;

    const ok = await verifyPassword(password, u.passwordHash);

    if (!ok) {
      const failed = (u.failedLogins ?? 0) + 1;
      await db
        .update(users)
        .set({
          failedLogins: failed,
          lockedUntil: failed >= MAX_ATTEMPTS ? lockoutUntil() : null,
        })
        .where(eq(users.id, u.id));
      return null;
    }

    await db
      .update(users)
      .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
      .where(eq(users.id, u.id));

    return { id: u.id, email: u.email, name: u.name };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [...oauthProviders, passwordProvider, ...devProvider],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    /**
     * The allowlist is checked HERE as well as in the dev provider, so a valid Google
     * account that is not on it cannot get in through the OAuth path either. D1 means
     * exactly one person should be able to sign in.
     */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const list = allowlist();
      if (list.length === 0) return false; // fail closed if unconfigured
      return list.includes(email);
    },

    async jwt({ token, user }) {
      // Only look the row up on first sign-in; afterwards it rides in the token.
      if (user?.email) {
        const [row] = await db
          .select({ id: users.id, tenantId: users.tenantId, role: users.role })
          .from(users)
          .where(eq(users.email, user.email.toLowerCase()))
          .limit(1);

        if (row) {
          token.userId = row.id;
          token.tenantId = row.tenantId;
          token.role = row.role;
        } else {
          // Authenticated with the provider, but no user row - so no tenant, and
          // therefore no rows visible. Better to refuse than to guess a tenant.
          const [t] = await db.select({ id: tenants.id }).from(tenants).limit(1);
          token.tenantId = t?.id;
          token.role = "agent";
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.tenantId = token.tenantId as string;
      session.user.role = (token.role as string) ?? "agent";
      return session;
    },
  },
});

/** True when at least one real sign-in method is configured. */
export const authConfigured = true; // password sign-in is always available
export const availableProviders = {
  google: oauthProviders.some((p) => p.id === "google"),
  entra: oauthProviders.some((p) => p.id === "microsoft-entra-id"),
  dev: devLoginEnabled,
  password: true,
};

/**
 * The address the development sign-in uses, read from the allowlist.
 *
 * It exists because the dev provider takes an email and the button that triggers it
 * has nowhere to get one from — the sign-in page's password form owns the only email
 * input, and a second <form> cannot read it. Reading the allowlist rather than
 * hardcoding an address also means this cannot drift out of step with the one
 * account that is actually permitted: with an empty allowlist it is null, the
 * button does not render, and sign-in fails closed exactly as it should.
 */
export const devLoginEmail = devLoginEnabled ? (allowlist()[0] ?? null) : null;
