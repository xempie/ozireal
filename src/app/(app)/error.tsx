"use client";

import { RecoverScreen } from "@/components/shell/recover";

/**
 * Errors inside the console. Renders within the shell, so the sidebar stays and the
 * agent can navigate away. See RecoverScreen for the post-deploy self-reload.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RecoverScreen error={error} reset={reset} />;
}
