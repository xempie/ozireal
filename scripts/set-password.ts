import { eq } from "drizzle-orm";
// Relative, not the "@/" alias: tsconfig maps that under src/, so a CLI living
// in scripts/ resolves it only by accident of the working directory. On the
// server it did not resolve at all.
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword } from "../src/server/auth/password";

/**
 * Set or reset a user's password.
 *
 *   tsx scripts/set-password.ts sam@ozirealty.com.au 'a long passphrase'
 *
 * Deliberately a CLI rather than a screen. There is no self-registration and no
 * password-reset email flow (SES lands in a later phase), so the only way to
 * create a credential is to already have access to the server — which is the
 * correct bar for the single account that can see every client record.
 *
 * The password is passed as an argument, so it lands in shell history. Clear it
 * afterwards, or prefix the command with a space where the shell honours that.
 */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("usage: tsx scripts/set-password.ts <email> <password>");
    process.exit(1);
  }

  const [u] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);

  if (!u) {
    console.error(`No user with that address. Users are created by bootstrap-production.ts,`);
    console.error(`and the address must also be in AUTH_ALLOWED_EMAILS.`);
    process.exit(1);
  }

  const hash = await hashPassword(password);
  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSetAt: new Date(),
      // Any lockout from previous failures is cleared: setting a new password
      // is a deliberate act by someone with server access.
      failedLogins: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, u.id));

  console.log(`password set for ${email} (${u.name})`);
  console.log("scrypt, salted per user. The plaintext is not stored anywhere.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
