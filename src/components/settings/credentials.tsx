"use client";

import * as React from "react";
import { KeyRound, Check, AlertCircle, Trash2 } from "lucide-react";
import { useAction, FormError, SubmitButton } from "@/components/forms/action-form";
import { saveSecret, removeSecret } from "@/server/actions/secrets";
import { Badge } from "@/components/ui";

/**
 * Provider credentials, entered here rather than in a file on the server.
 *
 * The value only ever travels one way. This component receives whether a key is
 * set, where it came from and its last four characters — never the key — so there
 * is no version of this screen that can leak one, however it is rendered, cached
 * or screenshotted.
 */

export type SecretStatus = {
  name: string;
  configured: boolean;
  source: "stored" | "environment" | null;
  lastFour: string | null;
  updatedAt: Date | null;
};

const LABELS: Record<string, { label: string; hint: string; where: string }> = {
  ANTHROPIC_API_KEY: {
    label: "Anthropic",
    hint: "Summaries, rolling briefs and match reasons.",
    where: "console.anthropic.com → API keys",
  },
  DEEPGRAM_API_KEY: {
    label: "Deepgram",
    hint: "Voice note transcription.",
    where: "console.deepgram.com",
  },
  MESSAGEMEDIA_KEY: {
    label: "MessageMedia key",
    hint: "Sending SMS.",
    where: "hub.messagemedia.com → API credentials",
  },
  MESSAGEMEDIA_SECRET: {
    label: "MessageMedia secret",
    hint: "Paired with the key above.",
    where: "hub.messagemedia.com → API credentials",
  },
};

function Row({ status }: { status: SecretStatus }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");
  const save = useAction(saveSecret, {
    onSuccess: () => {
      setValue("");
      setEditing(false);
    },
  });
  const remove = useAction(removeSecret);
  const meta = LABELS[status.name] ?? { label: status.name, hint: "", where: "" };

  return (
    <div className="p-3 border-b last:border-b-0">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12.5px] font-medium">{meta.label}</span>
            {status.configured ? (
              <Badge tone={status.source === "stored" ? "sent" : "neutral"}>
                <Check size={10} />
                {status.source === "stored" ? `saved · …${status.lastFour}` : "from environment"}
              </Badge>
            ) : (
              <Badge tone="queue">not set</Badge>
            )}
          </div>
          <p className="text-3 text-[11.5px] mt-0.5">{meta.hint}</p>
        </div>

        {!editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                save.reset();
                setEditing(true);
              }}
              className="text-[12px] px-2.5 min-h-8 rounded-md surface-2 border hover:surface-3"
            >
              {status.source === "stored" ? "Replace" : "Add key"}
            </button>
            {status.source === "stored" && (
              <button
                type="button"
                disabled={remove.pending}
                onClick={() => remove.run({ name: status.name })}
                title="Remove the stored key"
                className="text-[12px] px-2 min-h-8 rounded-md surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] hover:bg-[#d03b3b]/8 disabled:opacity-60"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <form
          className="mt-2.5 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.run({ name: status.name, value });
          }}
        >
          <div className="flex items-center gap-2 surface-2 border rounded-md px-2.5 focus-within:ring-2 focus-within:ring-[var(--accent)]/30">
            <KeyRound size={13} className="text-3 shrink-0" />
            <input
              // type=password so it is not shoulder-surfable, and autoComplete off
              // so no browser or manager offers to remember an agency credential.
              type="password"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste the key"
              className="bg-transparent outline-none text-[16px] sm:text-[13px] w-full py-2 font-mono"
            />
          </div>
          {meta.where && (
            <p className="text-3 text-[11px]">Find it at {meta.where}</p>
          )}
          <FormError message={save.error} />
          <div className="flex gap-2">
            <SubmitButton pending={save.pending} size="sm">
              Save
            </SubmitButton>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue("");
              }}
              className="text-[12px] px-2.5 min-h-8 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <FormError message={remove.error} />
    </div>
  );
}

export function CredentialsCard({
  statuses,
  encryptionReady,
}: {
  statuses: SecretStatus[];
  encryptionReady: boolean;
}) {
  return (
    <div className="surface-2 border rounded-lg overflow-hidden">
      {!encryptionReady && (
        <div className="flex items-start gap-2 text-[12px] border-b border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5">
          <AlertCircle size={14} className="shrink-0 mt-px" />
          <span>
            The server has no <code className="font-mono">SECRETS_KEY</code> set, so
            keys cannot be encrypted and cannot be saved here. Set one and restart.
          </span>
        </div>
      )}
      {statuses.map((s) => (
        <Row key={s.name} status={s} />
      ))}
    </div>
  );
}
