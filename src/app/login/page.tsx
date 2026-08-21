"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight, AlertCircle, Info } from "lucide-react";

/**
 * Fake sign-in. There is no auth here and no backend — the form checks a hardcoded
 * pair and pushes to /dashboard. Phase 1 replaces this with Auth.js v5 (Google +
 * Microsoft Entra), at which point this whole route disappears.
 */

const DEMO_EMAIL = "sam@ozirealty.com.au";
const DEMO_PASSWORD = "ozi2026";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState(DEMO_EMAIL);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError("That email and password combination is not recognised.");
      return;
    }
    setBusy(true);
    try {
      window.sessionStorage.setItem("ozi-demo-session", email.trim());
    } catch {
      /* private browsing — the prototype does not depend on this */
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-10 border-r surface-2">
        <div className="flex items-center gap-2.5">
          <span className="h-8 w-8 rounded-md bg-[var(--accent)] text-white grid place-items-center text-[15px] font-bold">
            O
          </span>
          <span className="font-semibold text-[16px]">Ozi Realty</span>
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

          <dl className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
            {[
              ["12", "contacts"],
              ["7", "listings"],
              ["6", "awaiting approval"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="text-[22px] font-semibold tabular leading-none">{v}</dt>
                <dd className="text-3 text-[11.5px] mt-1">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-3 text-[11.5px]">
          Adelaide, South Australia · RLA 123456
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-[360px]">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="h-8 w-8 rounded-md bg-[var(--accent)] text-white grid place-items-center text-[15px] font-bold">
              O
            </span>
            <span className="font-semibold text-[16px]">Ozi Realty</span>
          </div>

          <h2 className="text-[20px] font-semibold tracking-[-0.01em]">Sign in</h2>
          <p className="text-2 text-[13px] mt-1">
            Management console for the agency.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-[12px] font-medium text-2 mb-1.5"
              >
                Email
              </label>
              <div className="flex items-center gap-2 surface-2 border rounded-md px-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]">
                <Mail size={14} className="text-3 shrink-0" />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-transparent outline-none text-[13.5px] w-full py-2"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-[12px] font-medium text-2 mb-1.5"
              >
                Password
              </label>
              <div className="flex items-center gap-2 surface-2 border rounded-md px-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)]">
                <Lock size={14} className="text-3 shrink-0" />
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the demo password"
                  className="bg-transparent outline-none text-[13.5px] w-full py-2 placeholder:text-[var(--text-3)]"
                />
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 text-[12.5px] rounded-md border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5"
              >
                <AlertCircle size={14} className="shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-white text-[13.5px] font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight size={15} />}
            </button>
          </form>

          <div className="mt-6 rounded-md border border-[#2a78d6]/35 bg-[#2a78d6]/6 p-3 text-[12px]">
            <div className="flex items-start gap-2">
              <Info size={13} className="shrink-0 mt-px" />
              <div>
                <div className="font-semibold mb-1">Prototype credentials</div>
                <div className="text-2 leading-relaxed">
                  <code className="font-mono">{DEMO_EMAIL}</code>
                  <br />
                  <code className="font-mono">{DEMO_PASSWORD}</code>
                </div>
                <p className="text-3 mt-2 leading-relaxed">
                  There is no authentication behind this form and no session to steal —
                  it checks a hardcoded pair in the browser. Phase 1 replaces it with
                  Auth.js and Google or Microsoft sign-in.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
