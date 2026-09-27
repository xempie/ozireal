"use client";

import { RecoverScreen } from "@/components/shell/recover";

/** Errors on the public site and the login page. See RecoverScreen. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverScreen error={error} reset={reset} />;
}
