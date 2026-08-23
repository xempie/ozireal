"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/action";

/**
 * Form plumbing for Server Actions.
 *
 * The prototype's buttons were inert. These are not, which means they can fail — and a
 * write that fails silently is worse than one that never happened, because the user
 * walks away believing it landed. So every form here has three visible states: pending,
 * failed with a reason, and succeeded.
 *
 * Field errors come back from the same Zod schema the server validates against, so the
 * message under an input is the server's opinion, not a second client-side copy of the
 * rules that can drift out of step with it.
 */

type State<T> = ActionResult<T> | null;

export function useAction<T>(
  action: (input: unknown) => Promise<ActionResult<T>>,
  opts?: { onSuccess?: (data: T) => void; refreshOnSuccess?: boolean },
) {
  const router = useRouter();
  const [state, setState] = React.useState<State<T>>(null);
  const [sending, setSending] = React.useState(false);
  const [refreshing, startTransition] = React.useTransition();

  // Callers pass a fresh options object every render. Reading them through a ref keeps
  // `run` stable, so a caller can safely put it in an effect or a memo later.
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const run = React.useCallback(
    async (input: unknown) => {
      setState(null);
      setSending(true);
      try {
        const result = await action(input);
        setState(result);

        if (result.ok) {
          /**
           * onSuccess runs OUTSIDE the transition, deliberately.
           *
           * The obvious version wraps the whole call in startTransition and lets
           * onSuccess close the dialog from in there. It does not work: a transition
           * that also calls router.refresh() holds its updates until the server
           * responds, so the dialog stays open over the top of the very row it just
           * created. Closing it is a response to the user's click and belongs at
           * normal priority; only the re-fetch is the low-priority part.
           */
          optsRef.current?.onSuccess?.(result.data);

          // Server Components hold the data, so a successful write has to invalidate
          // them or the screen keeps rendering what was true a moment ago.
          if (optsRef.current?.refreshOnSuccess !== false) {
            startTransition(() => router.refresh());
          }
        }
        return result;
      } finally {
        setSending(false);
      }
    },
    [action, router],
  );

  return {
    run,
    // Still "pending" while the refreshed screen is on its way, so the button cannot
    // be pressed a second time into what still looks like the old data.
    pending: sending || refreshing,
    state,
    reset: () => setState(null),
    error: state && !state.ok ? state.error : null,
    fieldErrors: state && !state.ok ? (state.fieldErrors ?? {}) : {},
    succeeded: !!state?.ok,
  };
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p className="text-[11.5px] text-[#b02f2f] dark:text-[#f08a8a] mt-1">
      {errors[0]}
    </p>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 text-[12.5px] rounded-md border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5"
    >
      <AlertCircle size={14} className="shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}

export function FormSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 text-[12.5px] rounded-md border border-[#008300]/40 bg-[#008300]/8 p-2.5">
      <Check size={14} className="shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
}: {
  pending: boolean;
  children: React.ReactNode;
  variant?: "primary" | "default" | "danger";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-[var(--accent)] text-white border border-transparent hover:opacity-90",
    default: "surface-2 border hover:surface-3",
    danger:
      "surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] hover:bg-[#d03b3b]/8",
  };
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-60",
        size === "sm" ? "text-[12px] px-2.5 min-h-8" : "text-[13px] px-3 min-h-9",
        variants[variant],
        className,
      )}
    >
      {pending && <Loader2 size={13} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Input({
  label,
  name,
  errors,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  errors?: string[];
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="block text-[12px] font-medium text-2 mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...rest}
        className={cn(
          "w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none",
          "focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]",
          errors?.length && "border-[#d03b3b]/60",
        )}
      />
      <FieldError errors={errors} />
    </div>
  );
}

export function Textarea({
  label,
  name,
  errors,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  errors?: string[];
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="block text-[12px] font-medium text-2 mb-1.5"
      >
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        {...rest}
        className={cn(
          "w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none resize-y",
          "focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]",
          errors?.length && "border-[#d03b3b]/60",
        )}
      />
      <FieldError errors={errors} />
    </div>
  );
}

export function Select({
  label,
  name,
  errors,
  options,
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  errors?: string[];
  options: { value: string; label: string }[];
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="block text-[12px] font-medium text-2 mb-1.5"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        {...rest}
        className={cn(
          "w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none",
          "focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]",
          errors?.length && "border-[#d03b3b]/60",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError errors={errors} />
    </div>
  );
}

/** A modal that closes on Escape, on backdrop click, and after a successful write. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-start justify-center pt-[8vh] px-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="surface-2 border rounded-xl w-full max-w-[520px] shadow-xl mb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b">
          <h2 className="text-[14px] font-semibold">{title}</h2>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
