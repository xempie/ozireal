"use server";

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
