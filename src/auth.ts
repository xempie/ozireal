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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [...oauthProviders, ...devProvider],
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
export const authConfigured = oauthProviders.length > 0 || devLoginEnabled;
export const availableProviders = {
  google: oauthProviders.some((p) => p.id === "google"),
  entra: oauthProviders.some((p) => p.id === "microsoft-entra-id"),
  dev: devLoginEnabled,
};
