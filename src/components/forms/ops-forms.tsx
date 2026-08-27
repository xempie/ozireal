"use client";

import * as React from "react";
import { Plus, Check } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Select,
  SubmitButton,
  FormError,
} from "./action-form";
import { createTask, completeTask, createCalendarEvent } from "@/server/actions/ops";
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
