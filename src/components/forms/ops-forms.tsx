"use client";

import * as React from "react";
import { Plus, Check, Pencil, Trash2, RotateCcw, X } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  Select,
  SubmitButton,
  CancelButton,
  FormError,
  RowButton,
  ConfirmButton,
  ActionButton,
  toLocalInput,
} from "./action-form";
import {
  createTask,
  completeTask,
  createCalendarEvent,
  updateTask,
  reopenTask,
  deleteTask,
  updateCalendarEvent,
  cancelCalendarEvent,
  setSeoIssueStatus,
  createRedirect,
  updateRedirect,
  deleteRedirect,
} from "@/server/actions/ops";
import type { Option } from "./stock-forms";

/** A local datetime string the browser's datetime-local input produces. */
function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  // Local time, deliberately: an agent thinks in Adelaide time, and toISOString
  // would silently shift the default by the UTC offset.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NewTaskButton({
  contacts,
  listings,
}: {
  contacts: Option[];
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(createTask, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <Plus size={13} />
        New task
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(Object.fromEntries(new FormData(e.currentTarget).entries()));
          }}
        >
          <Input
            label="What needs doing"
            name="title"
            required
            placeholder="Send the Powell St contract to the conveyancer"
            errors={a.fieldErrors.title}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="About"
              name="contactId"
              options={[{ value: "", label: "Nobody in particular" }, ...contacts]}
              errors={a.fieldErrors.contactId}
            />
            <Select
              label="Due"
              name="dueInDays"
              defaultValue="1"
              options={[
                { value: "0", label: "Today" },
                { value: "1", label: "Tomorrow" },
                { value: "3", label: "In 3 days" },
                { value: "7", label: "In a week" },
                { value: "14", label: "In 2 weeks" },
              ]}
            />
          </div>
          <Select
            label="Property"
            name="listingId"
            options={[{ value: "", label: "Not about a listing" }, ...listings]}
            errors={a.fieldErrors.listingId}
          />

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Add task</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Ticking a task off, from the list. */
export function CompleteTaskButton({ id }: { id: string }) {
  const a = useAction(completeTask);
  return (
    <button
      type="button"
      disabled={a.pending}
      onClick={() => a.run({ id })}
      title={a.error ?? "Mark done"}
      className="inline-flex items-center gap-1 text-[11.5px] px-2 min-h-7 rounded-md surface-2 border hover:surface-3 disabled:opacity-60"
    >
      <Check size={11} />
      {a.pending ? "…" : "Done"}
    </button>
  );
}

export function NewEventButton({
  contacts,
  listings,
}: {
  contacts: Option[];
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(createCalendarEvent, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <Plus size={13} />
        New event
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New calendar event">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(Object.fromEntries(new FormData(e.currentTarget).entries()));
          }}
        >
          <Input
            label="What is it"
            name="title"
            required
            placeholder="Open inspection — 12 Powell St"
            errors={a.fieldErrors.title}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Kind"
              name="kind"
              defaultValue="inspection"
              options={[
                { value: "inspection", label: "Inspection" },
                { value: "appraisal", label: "Appraisal" },
                { value: "meeting", label: "Meeting" },
                { value: "settlement", label: "Settlement" },
                { value: "personal", label: "Personal" },
              ]}
              errors={a.fieldErrors.kind}
            />
            <Select
              label="How long"
              name="durationMinutes"
              defaultValue="30"
              options={[
                { value: "15", label: "15 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "45", label: "45 minutes" },
                { value: "60", label: "1 hour" },
                { value: "120", label: "2 hours" },
              ]}
            />
          </div>
          <Input
            label="Starts"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultStart()}
            errors={a.fieldErrors.startsAt}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="With"
              name="contactId"
              options={[{ value: "", label: "Nobody in particular" }, ...contacts]}
              errors={a.fieldErrors.contactId}
            />
            <Select
              label="Property"
              name="listingId"
              options={[{ value: "", label: "Not about a listing" }, ...listings]}
              errors={a.fieldErrors.listingId}
            />
          </div>

          <p className="text-3 text-[11.5px] leading-relaxed">
            Saved here only. Two-way sync with Google and Outlook is planned but not
            built, so this will not appear in your phone&apos;s calendar yet — and when
            sync does arrive it will know this event was ours to manage.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Add event</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------- editing a task */

export type EditableTask = {
  id: string;
  title: string;
  contactId: string | null;
  listingId: string | null;
  dueAt: Date | null;
};

/**
 * Correcting a task.
 *
 * The create dialog offers "due in N days" because that is how a task is spoken
 * about when it is written. Editing needs the actual date — "in 3 days" from a task
 * created last week means something different now, and re-picking a relative offset
 * would silently push the deadline.
 */
export function EditTaskButton({
  task,
  contacts,
  listings,
}: {
  task: EditableTask;
  contacts: Option[];
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateTask, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this task">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit task">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: task.id,
            });
          }}
        >
          <Input
            label="What needs doing"
            name="title"
            required
            defaultValue={task.title}
            errors={a.fieldErrors.title}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="About"
              name="contactId"
              defaultValue={task.contactId ?? ""}
              options={[{ value: "", label: "Nobody in particular" }, ...contacts]}
              errors={a.fieldErrors.contactId}
            />
            <Input
              label="Due"
              name="dueAt"
              type="datetime-local"
              defaultValue={toLocalInput(task.dueAt)}
              errors={a.fieldErrors.dueAt}
            />
          </div>
          <p className="text-3 text-[11px] -mt-2">
            Clearing the date leaves the task with no deadline, which sorts it last
            rather than making it look due today.
          </p>
          <Select
            label="Property"
            name="listingId"
            defaultValue={task.listingId ?? ""}
            options={[{ value: "", label: "Not about a listing" }, ...listings]}
            errors={a.fieldErrors.listingId}
          />

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Ticked off by mistake, or it turned out not to be finished. */
export function ReopenTaskButton({ id }: { id: string }) {
  return (
    <ActionButton action={reopenTask} input={{ id }} title="Put it back on the list">
      <RotateCcw size={11} />
      Reopen
    </ActionButton>
  );
}

/**
 * A real delete, unlike most things here — a task is a reminder, not evidence.
 * The audit row survives, and so does the interaction it was extracted from.
 */
export function DeleteTaskButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      action={deleteTask}
      input={{ id }}
      confirmLabel="Delete it"
      title="Delete this task"
    >
      <Trash2 size={11} />
      Delete
    </ConfirmButton>
  );
}

/* ---------------------------------------------------- editing an event */

export type EditableEvent = {
  id: string;
  title: string;
  kind: string | null;
  startsAt: Date;
  endsAt: Date | null;
  ourWrite: boolean;
  provider: string;
  contactId: string | null;
  listingId: string | null;
};

/**
 * Editing a diary entry — ours only.
 *
 * An event synced in from Google or Outlook is shown with a padlock and no
 * controls, because the external calendar stays the source of truth for anything it
 * owns. The server refuses it too; this just means the agent is not offered a
 * button that is going to say no.
 */
export function EditEventButton({
  event,
  contacts,
  listings,
}: {
  event: EditableEvent;
  contacts: Option[];
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateCalendarEvent, { onSuccess: () => setOpen(false) });

  if (!event.ourWrite) return null;

  const minutes = event.endsAt
    ? Math.max(5, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 60000))
    : 30;
  const DURATIONS = [15, 30, 45, 60, 120];

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this event">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit event">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: event.id,
            });
          }}
        >
          <Input
            label="What is it"
            name="title"
            required
            defaultValue={event.title}
            errors={a.fieldErrors.title}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Kind"
              name="kind"
              defaultValue={event.kind ?? "meeting"}
              options={[
                { value: "inspection", label: "Inspection" },
                { value: "appraisal", label: "Appraisal" },
                { value: "meeting", label: "Meeting" },
                { value: "settlement", label: "Settlement" },
                { value: "personal", label: "Personal" },
              ]}
              errors={a.fieldErrors.kind}
            />
            <Select
              label="How long"
              name="durationMinutes"
              /* The stored length may not be one of the presets - a synced or
                 hand-edited event can be any duration - so it is added rather than
                 rounded to the nearest option, which would move the end time. */
              defaultValue={String(minutes)}
              options={(DURATIONS.includes(minutes)
                ? DURATIONS
                : [...DURATIONS, minutes].sort((x, y) => x - y)
              ).map((m) => ({
                value: String(m),
                label: m >= 60 && m % 60 === 0 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`,
              }))}
              errors={a.fieldErrors.durationMinutes}
            />
          </div>
          <Input
            label="Starts"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toLocalInput(event.startsAt)}
            errors={a.fieldErrors.startsAt}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="With"
              name="contactId"
              defaultValue={event.contactId ?? ""}
              options={[{ value: "", label: "Nobody in particular" }, ...contacts]}
              errors={a.fieldErrors.contactId}
            />
            <Select
              label="Property"
              name="listingId"
              defaultValue={event.listingId ?? ""}
              options={[{ value: "", label: "Not about a listing" }, ...listings]}
              errors={a.fieldErrors.listingId}
            />
          </div>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Cancelled, not deleted, so the sync has something to push when it lands. */
export function CancelEventButton({
  id,
  ourWrite,
}: {
  id: string;
  ourWrite: boolean;
}) {
  if (!ourWrite) return null;
  return (
    <ConfirmButton
      action={cancelCalendarEvent}
      input={{ id }}
      confirmLabel="Cancel it"
      title="Take this off the calendar"
    >
      <X size={11} />
      Cancel
    </ConfirmButton>
  );
}

/* -------------------------------------------------------- SEO findings */

/**
 * Rule 4, as two buttons.
 *
 * "Accept" means accept into a change set a human still has to apply — there is no
 * action anywhere that publishes one, and there is no disabled button pretending
 * there could be. Both decisions are reversible, because a dismissal that cannot be
 * taken back is one nobody will risk making.
 */
export function SeoIssueButtons({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {status !== "accepted" && (
        <ActionButton
          action={setSeoIssueStatus}
          input={{ id, status: "accepted" }}
          title="Add to the change set for review"
        >
          <Check size={12} />
          Accept into change set
        </ActionButton>
      )}
      {status !== "dismissed" && (
        <ActionButton action={setSeoIssueStatus} input={{ id, status: "dismissed" }}>
          <X size={12} />
          Dismiss
        </ActionButton>
      )}
      {status !== "open" && (
        <ActionButton
          action={setSeoIssueStatus}
          input={{ id, status: "open" }}
          title="Undo that decision"
        >
          <RotateCcw size={11} />
          Reopen
        </ActionButton>
      )}
      {status === "accepted" && (
        <ConfirmButton
          action={setSeoIssueStatus}
          input={{ id, status: "resolved" }}
          confirmLabel="It is applied"
          tone="plain"
          title="Mark as applied on the live site"
        >
          Mark applied
        </ConfirmButton>
      )}
    </div>
  );
}

/* ------------------------------------------------------- the redirect map */

export type EditableRedirect = {
  id: string;
  from: string;
  to: string | null;
  status: string;
  note: string | null;
};

const REDIRECT_STATUSES = [
  { value: "undecided", label: "Undecided" },
  { value: "mapped", label: "Mapped" },
  { value: "blocked", label: "Blocked" },
];

function RedirectFields({
  a,
  redirect,
}: {
  a: ReturnType<typeof useAction<unknown>>;
  redirect?: EditableRedirect;
}) {
  return (
    <>
      <Input
        label="Old address on the Wix site"
        name="fromPath"
        required
        placeholder="/oversees-investment"
        defaultValue={redirect?.from ?? ""}
        errors={a.fieldErrors.fromPath}
      />
      <Input
        label="Where it should go"
        name="toPath"
        placeholder="/services/overseas-investment"
        defaultValue={redirect?.to ?? ""}
        errors={a.fieldErrors.toPath}
      />
      <p className="text-3 text-[11px] -mt-2">
        A page with no equivalent goes to the nearest parent — never to the home page
        and never to a 404, both of which throw away the link equity the old address
        earned.
      </p>
      <Select
        label="Status"
        name="status"
        defaultValue={redirect?.status ?? "undecided"}
        options={REDIRECT_STATUSES}
        errors={a.fieldErrors.status}
      />
      <p className="text-3 text-[11px] -mt-2">
        &ldquo;Mapped&rdquo; is a claim that this row is finished, so it is refused
        without a destination. Leave it undecided until you know.
      </p>
      <Textarea
        label="Note"
        name="note"
        rows={2}
        defaultValue={redirect?.note ?? ""}
        errors={a.fieldErrors.note}
      />
    </>
  );
}

export function NewRedirectButton() {
  const [open, setOpen] = React.useState(false);
  const a = useAction(createRedirect, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => { a.reset(); setOpen(true); }}
        className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
      >
        <Plus size={13} />
        Add redirect
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add a redirect">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run(Object.fromEntries(new FormData(e.currentTarget).entries()));
          }}
        >
          <RedirectFields a={a as ReturnType<typeof useAction<unknown>>} />
          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Add it</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

export function EditRedirectButton({ redirect }: { redirect: EditableRedirect }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateRedirect, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this redirect">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit redirect">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: redirect.id,
            });
          }}
        >
          <RedirectFields a={a as ReturnType<typeof useAction<unknown>>} redirect={redirect} />
          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeleteRedirectButton({ id }: { id: string }) {
  return (
    <ConfirmButton
      action={deleteRedirect}
      input={{ id }}
      confirmLabel="Remove it"
      title="Remove this redirect"
    >
      <Trash2 size={11} />
      Remove
    </ConfirmButton>
  );
}
