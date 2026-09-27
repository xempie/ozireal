"use client";

import { RecoverScreen } from "@/components/shell/recover";

/**
 * The last resort: an error in the root layout itself, which replaces the whole
 * document, hence its own <html> and <body>.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en-AU">
      <body>
        <RecoverScreen error={error} />
      </body>
    </html>
  );
}
