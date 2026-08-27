import type { NextAuthConfig } from "next-auth";

/**
 * The EDGE-SAFE half of the auth configuration.
 *
 * Middleware runs on the Edge runtime, which has no `node:crypto` and no TCP
 * sockets — so it cannot load the password provider (scrypt) or the database
 * client. Importing the full config there fails the build with an unhelpful
 * "Reading from node:crypto is not handled by plugins".
 *
 * So this file holds only what middleware needs to answer one question — is
 * there a valid session — and `src/auth.ts` adds the providers for the Node
 * runtime, where the real work happens. Splitting them is the documented
 * Auth.js v5 arrangement, not a workaround.
 */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  callbacks: {
    /**
     * The JWT carries tenantId, so middleware can gate a request without a
     * database round trip. It is populated in src/auth.ts at sign-in.
     */
    jwt({ token }) {
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? token.sub ?? "");
        session.user.tenantId = String(token.tenantId ?? "");
        session.user.role = String(token.role ?? "agent");
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
