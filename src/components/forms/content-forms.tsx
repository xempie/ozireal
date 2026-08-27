"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  Select,
  SubmitButton,
  FormError,
} from "./action-form";
import { createCampaign } from "@/server/actions/campaigns";
import { createBlogPost, createSocialPost } from "@/server/actions/content";
import { createProposal } from "@/server/actions/proposals";
import type { Option } from "./stock-forms";

const trigger =
  "inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90";
const cancel = "text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3";

function fields(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget).entries());
}

/* ------------------------------------------------------------- campaign */

export function NewCampaignButton({ listings }: { listings: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const [hasListing, setHasListing] = React.useState(false);
  const a = useAction(createCampaign, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className={trigger}
      >
        <Plus size={13} />
        New campaign
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New campaign">
        <form className="space-y-3" onSubmit={(e) => a.run(fields(e))}>
          <Input
            label="Name"
            name="name"
            required
            placeholder="12 Powell St — new to market"
            errors={a.fieldErrors.name}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Channel"
              name="channel"
              defaultValue="email"
              options={[
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
              ]}
              errors={a.fieldErrors.channel}
            />
            <Select
              label="About a listing"
              name="listingId"
              onChange={(e) => setHasListing(!!e.target.value)}
              options={[{ value: "", label: "No listing" }, ...listings]}
              errors={a.fieldErrors.listingId}
            />
          </div>

          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              name="seedFromMatches"
              disabled={!hasListing}
              className="mt-0.5 accent-[var(--accent)] disabled:opacity-40"
            />
            <span className={hasListing ? "" : "opacity-50"}>
              Start the recipient list from the contacts already matched to that listing
            </span>
          </label>

          <p className="text-3 text-[11.5px] leading-relaxed">
            Saved as a <strong>draft</strong>, and it can only be saved as a draft.
            Drafts go to the approval queue, and consent is checked again at the instant
            of sending — so someone who unsubscribes tomorrow is blocked and logged
            rather than quietly dropped from this list today.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Create draft campaign</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className={cancel}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------- content */

export function NewDraftButton({ listings }: { listings: Option[] }) {
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"article" | "social">("article");
  const close = () => setOpen(false);
  const article = useAction(createBlogPost, { onSuccess: close });
  const social = useAction(createSocialPost, { onSuccess: close });

  return (
    <>
      <button
        onClick={() => {
          article.reset();
          social.reset();
          setOpen(true);
        }}
        className={trigger}
      >
        <Plus size={13} />
        New draft
      </button>

      <Modal open={open} onClose={close} title="New draft">
        {/* An article and a social post are different rows in different tables with
            different rules; one form pretending they are the same shape is how a
            600-word article ends up in a 2,200-character field. */}
        <div className="flex gap-1 mb-3 p-0.5 rounded-md surface-2 border w-fit">
          {(["article", "social"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                "text-[12.5px] px-2.5 min-h-7 rounded " +
                (kind === k ? "bg-[var(--accent)] text-white" : "hover:surface-3")
              }
            >
              {k === "article" ? "Article" : "Social post"}
            </button>
          ))}
        </div>

        {kind === "article" ? (
          <form className="space-y-3" onSubmit={(e) => article.run(fields(e))}>
            <Input
              label="Title"
              name="title"
              required
              placeholder="What $750,000 buys in Norwood this spring"
              errors={article.fieldErrors.title}
            />
            <Textarea label="Body" name="body" rows={10} errors={article.fieldErrors.body} />
            <p className="text-3 text-[11px] -mt-2">
              The web address comes from the title and is never reused, so a link shared
              today cannot later open a different article.
            </p>
            <FormError message={article.error} />
            <div className="flex gap-2 pt-1">
              <SubmitButton pending={article.pending}>Save draft</SubmitButton>
              <button type="button" onClick={close} className={cancel}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(e) => social.run(fields(e))}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Select
                label="Network"
                name="network"
                defaultValue="instagram"
                options={[
                  { value: "instagram", label: "Instagram" },
                  { value: "facebook", label: "Facebook" },
                  { value: "linkedin", label: "LinkedIn" },
                ]}
                errors={social.fieldErrors.network}
              />
              <Select
                label="About a listing"
                name="listingId"
                options={[{ value: "", label: "No listing" }, ...listings]}
                errors={social.fieldErrors.listingId}
              />
            </div>
            <Textarea label="Post" name="body" rows={6} errors={social.fieldErrors.body} />
            <FormError message={social.error} />
            <div className="flex gap-2 pt-1">
              <SubmitButton pending={social.pending}>Save draft</SubmitButton>
              <button type="button" onClick={close} className={cancel}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="text-3 text-[11.5px] leading-relaxed mt-3">
          Drafts only. Publishing is a human decision made in the approval queue.
        </p>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- proposal */

export function NewProposalButton({
  contacts,
  properties,
}: {
  contacts: Option[];
  properties: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(createProposal, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className={trigger}
      >
        <Plus size={13} />
        New proposal
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New proposal">
        {/* An empty picker with no explanation reads as a broken form. A proposal
            is addressed to a person, so with nobody on file there is nothing to
            address it to — say that rather than showing a dropdown of nothing. */}
        {contacts.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[12.5px] text-2">
              A proposal is written for a particular vendor, and there is nobody in the
              contact list yet. Add the vendor as a contact first — that way the
              proposal, the property and every conversation hang off one record.
            </p>
            <div className="flex gap-2 pt-1">
              <a
                href="/contacts"
                className="inline-flex items-center text-[13px] px-3 min-h-9 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
              >
                Go to contacts
              </a>
              <button type="button" onClick={() => setOpen(false)} className={cancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
        <form className="space-y-3" onSubmit={(e) => a.run(fields(e))}>
          <Select
            label="For"
            name="contactId"
            required
            options={[{ value: "", label: "Choose the vendor…" }, ...contacts]}
            errors={a.fieldErrors.contactId}
          />
          <Select
            label="Property"
            name="propertyId"
            options={[
              { value: "", label: "Not about a specific property yet" },
              ...properties,
            ]}
            errors={a.fieldErrors.propertyId}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Estimate from"
              name="estimateLow"
              type="number"
              min="0"
              placeholder="750000"
              errors={a.fieldErrors.estimateLow}
            />
            <Input
              label="Estimate to"
              name="estimateHigh"
              type="number"
              min="0"
              placeholder="800000"
              errors={a.fieldErrors.estimateHigh}
            />
          </div>
          <p className="text-3 text-[11px] -mt-2">
            Both figures or neither. An appraisal quoted as a single number is the shape
            under-quoting rules exist to catch — leave them blank until you have
            appraised it.
          </p>

          <p className="text-3 text-[11.5px] leading-relaxed">
            Saved as a draft. It carries the agency&apos;s name and a price to a
            prospective vendor, so it goes through the approval queue like any other
            outbound message.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Create draft proposal</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className={cancel}>
              Cancel
            </button>
          </div>
        </form>
        )}
      </Modal>
    </>
  );
}
