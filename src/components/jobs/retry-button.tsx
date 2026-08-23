"use client";

import { RotateCcw } from "lucide-react";
import { useAction, FormError } from "@/components/forms/action-form";
import { retryJob } from "@/server/actions/jobs";

export function RetryJobButton({ jobId }: { jobId: string }) {
  const a = useAction(retryJob);
  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={a.pending}
        onClick={() => a.run({ jobId })}
        className="inline-flex items-center gap-1.5 text-[11.5px] px-2 min-h-7 rounded-md surface-2 border hover:surface-3 disabled:opacity-60"
      >
        <RotateCcw size={11} />
        {a.pending ? "Retrying…" : "Retry"}
      </button>
      <FormError message={a.error} />
    </div>
  );
}
