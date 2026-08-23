import { redirect } from "next/navigation";
import { Lock, AlertCircle, Info } from "lucide-react";
import { auth, availableProviders } from "@/auth";
import { getAgency } from "@/server/queries";
import { signInWithGoogle, signInWithEntra, signInForDevelopment } from "./actions";

/**
 * Sign in.
 *
 * The prototype's version compared a hardcoded pair in the browser. This one is real:
 * Auth.js sets a signed session cookie, and the tenant on that session is what every
 * subsequent query runs as. Access is an allowlist (D1), checked on the OAuth path as
 * well as the development one - a valid Google account that is not on the list gets no
 * further than the callback.
 */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;
  const agency = await getAgency().catch(() => null);
  const nothingConfigured =
    !availableProviders.google && !availableProviders.entra && !availableProviders.dev;

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden lg:flex flex-col justify-between p-10 border-r surface-2">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-md bg-[var(--accent)] text-white grid place-items-center text-[15px] font-bold">
            O
          </span>
          <span className="font-semibold text-[16px]">
            {agency?.name ?? "Ozi Realty"}
          </span>
        </div>

        <div className="max-w-md">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.02em]">
            Every enquiry, every property, one contact list.
          </h1>
          <p className="text-2 text-[14px] mt-4 leading-relaxed">
            The console where enquiries from the website, email, SMS and social all land
            on one person&apos;s record — with an AI brief on where the relationship
            stands, and nothing sent without you approving it.
          </p>
        </div>

        <p className="text-3 text-[11.5px]">
          Adelaide, South Australia · {agency?.licence ?? "RLA 123456"}
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="h-8 w-8 rounded-md bg-[var(--accent)] text-white grid place-items-center text-[15px] font-bold">
              O
            </span>
            <span className="font-semibold text-[16px]">
              {agency?.name ?? "Ozi Realty"}
            </span>
          </div>

          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Sign in</h2>
          <p className="text-2 text-[13px] mt-1">
            Management console for the agency.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 text-[12.5px] rounded-md border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5"
            >
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>
                {error === "AccessDenied"
                  ? "That account is not on the allowlist for this agency."
                  : "Sign-in failed. Please try again."}
              </span>
            </div>
          )}

          <div className="mt-7 space-y-2.5">
            {availableProviders.google && (
              <form action={signInWithGoogle}>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md surface-2 border text-[13.5px] font-medium py-2.5 hover:surface-3 transition-colors"
                >
                  Continue with Google
                </button>
              </form>
            )}

            {availableProviders.entra && (
              <form action={signInWithEntra}>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md surface-2 border text-[13.5px] font-medium py-2.5 hover:surface-3 transition-colors"
                >
                  Continue with Microsoft
                </button>
              </form>
            )}

            {availableProviders.dev && (
              <form action={signInForDevelopment} className="space-y-2.5">
                {(availableProviders.google || availableProviders.entra) && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="h-px flex-1 bg-[var(--line)]" />
                    <span className="text-3 text-[11px]">or</span>
                    <span className="h-px flex-1 bg-[var(--line)]" />
                  </div>
                )}
                <div className="flex items-center gap-2 surface-2 border rounded-md px-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/30">
                  <Lock size={14} className="text-3 shrink-0" />
                  <input
                    name="email"
                    type="email"
                    required
                    defaultValue="sam@ozirealty.com.au"
                    className="bg-transparent outline-none text-[16px] sm:text-[13.5px] w-full py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-[var(--accent)] text-white text-[13.5px] font-medium py-2.5 hover:opacity-90 transition-opacity"
                >
                  Sign in
                </button>
              </form>
            )}
          </div>

          {nothingConfigured && (
            <div className="mt-6 rounded-md border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-3 text-[12px]">
              <div className="font-semibold mb-1">No sign-in method configured</div>
              <p className="text-2 leading-relaxed">
                Set <code className="font-mono">AUTH_GOOGLE_ID</code> and{" "}
                <code className="font-mono">AUTH_GOOGLE_SECRET</code> (or the Entra
                equivalents) for real sign-in, or{" "}
                <code className="font-mono">AUTH_DEV_LOGIN=1</code> for local work. An
                allowlist in <code className="font-mono">AUTH_ALLOWED_EMAILS</code> is
                required either way — with none set, sign-in fails closed.
              </p>
            </div>
          )}

          {availableProviders.dev && (
            <div className="mt-6 rounded-md border border-[#eda100]/50 bg-[#eda100]/10 p-3 text-[12px]">
              <div className="flex items-start gap-2">
                <Info size={13} className="shrink-0 mt-px" />
                <div>
                  <div className="font-semibold mb-1">Development sign-in is on</div>
                  <p className="text-2 leading-relaxed">
                    This takes no password. It is refused when{" "}
                    <code className="font-mono">NODE_ENV=production</code>, and the
                    address must still be on the allowlist — but it should not be enabled
                    on any host the public can reach.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
