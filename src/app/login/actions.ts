"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";

/**
 * Sign-in is a Server Action rather than a client call, so the OAuth redirect is
 * issued by the server and no provider configuration reaches the browser.
 */

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard" });
}

export async function signInWithEntra() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}

export async function signInForDevelopment(formData: FormData) {
  await signIn("dev", {
    email: String(formData.get("email") ?? ""),
    redirectTo: "/dashboard",
  });
}

/**
 * Email and password — the sign-in the console actually uses.
 *
 * `redirectTo` rather than a manual redirect, so Auth.js sets the session cookie
 * and navigates in one step. On failure it throws, and the catch turns that into
 * a query parameter the page renders: one message for every kind of failure,
 * because "no such user" and "wrong password" told apart is an account
 * enumeration oracle on a public URL.
 */
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("password", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    // NEXT_REDIRECT is how a successful signIn navigates; rethrow it untouched.
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) throw error;
    redirect("/login?error=CredentialsSignin");
  }
}
