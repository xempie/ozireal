"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Archive, ShieldCheck, X, Users } from "lucide-react";
import { useRouter } from "next/navigation";
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
} from "./action-form";
import {
  createCampaign,
  updateCampaign,
  deleteCampaign,
  cancelCampaign,
} from "@/server/actions/campaigns";
import {
  createBlogPost,
  createSocialPost,
  updateBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
  updateSocialPost,
  setSocialPostStatus,
  deleteSocialPost,
} from "@/server/actions/content";
import {
  createProposal,
  updateProposal,
  submitProposalForApproval,
  setProposalOutcome,
  deleteProposal,
} from "@/server/actions/proposals";
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

/* ------------------------------------------------------- editing an article */

export type EditableBlogPost = {
  id: string;
  title: string;
  body: string | null;
  status: string;
  slug: string;
};

export function EditDraftButton({ post }: { post: EditableBlogPost }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateBlogPost, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this article">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit article">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: post.id,
            });
          }}
        >
          <Input
            label="Title"
            name="title"
            required
            defaultValue={post.title}
            errors={a.fieldErrors.title}
          />
          <p className="text-3 text-[11px] -mt-2">
            The address stays <code className="tabular">/{post.slug}</code> whatever the
            title becomes. Slugs are never reused, so an article that has been shared
            keeps resolving where it was shared from.
          </p>
          <Textarea
            label="Body"
            name="body"
            rows={12}
            defaultValue={post.body ?? ""}
            errors={a.fieldErrors.body}
          />
          <p className="text-3 text-[11px] -mt-2">
            The word count is recomputed from this, so it cannot disagree with what is
            actually written.
          </p>

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

/**
 * The article lifecycle — and note what is missing from it.
 *
 * There is no Publish. Rule 1 puts everything outward-facing through the approval
 * queue, so the furthest a person can move an article from here is INTO that queue;
 * the approval screen is the only thing that publishes. Adding a publish button here
 * would be the autonomous path §3 forbids, dressed up as convenience.
 */
export function BlogStatusButtons({ post }: { post: EditableBlogPost }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {post.status === "draft" && (
        <ActionButton
          action={setBlogPostStatus}
          input={{ id: post.id, status: "in_approval" }}
          tone="primary"
          title="Nothing publishes without a human approving it"
        >
          <ShieldCheck size={11} />
          Send for approval
        </ActionButton>
      )}
      {post.status === "in_approval" && (
        <>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1 text-[11.5px] px-2 min-h-7 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
          >
            <ShieldCheck size={11} />
            Review in queue
          </Link>
          <ActionButton
            action={setBlogPostStatus}
            input={{ id: post.id, status: "draft" }}
            title="Pull it back out of the queue"
          >
            Back to draft
          </ActionButton>
        </>
      )}
      {post.status !== "archived" && post.status !== "in_approval" && (
        <ConfirmButton
          action={setBlogPostStatus}
          input={{ id: post.id, status: "archived" }}
          confirmLabel="Archive it"
          tone="plain"
          title="Takes it down, keeps the slug reserved"
        >
          <Archive size={11} />
          Archive
        </ConfirmButton>
      )}
      {post.status !== "published" && <DeleteDraftButton id={post.id} />}
    </div>
  );
}

export function DeleteDraftButton({ id }: { id: string }) {
  return (
    <ConfirmButton action={deleteBlogPost} input={{ id }} confirmLabel="Delete it">
      <Trash2 size={11} />
      Delete
    </ConfirmButton>
  );
}

/* ---------------------------------------------------- editing a social post */

export type EditableSocialPost = {
  id: string;
  network: string;
  body: string;
  status: string;
  listingId: string | null;
};

export function EditSocialButton({
  post,
  listings,
}: {
  post: EditableSocialPost;
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateSocialPost, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this post">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit social post">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: post.id,
            });
          }}
        >
          <Select
            label="Network"
            name="network"
            defaultValue={post.network}
            options={[
              { value: "instagram", label: "Instagram" },
              { value: "facebook", label: "Facebook" },
              { value: "linkedin", label: "LinkedIn" },
            ]}
            errors={a.fieldErrors.network}
          />
          <Textarea
            label="Post"
            name="body"
            rows={6}
            required
            defaultValue={post.body}
            errors={a.fieldErrors.body}
          />
          <Select
            label="About a listing"
            name="listingId"
            defaultValue={post.listingId ?? ""}
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

/** Same lifecycle and the same missing Publish as the article buttons above. */
export function SocialStatusButtons({ post }: { post: EditableSocialPost }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {post.status === "draft" && (
        <ActionButton
          action={setSocialPostStatus}
          input={{ id: post.id, status: "in_approval" }}
          tone="primary"
        >
          <ShieldCheck size={11} />
          Send for approval
        </ActionButton>
      )}
      {post.status === "in_approval" && (
        <>
          <Link
            href="/approvals"
            className="inline-flex items-center gap-1 text-[11.5px] px-2 min-h-7 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
          >
            <ShieldCheck size={11} />
            Review in queue
          </Link>
          <ActionButton
            action={setSocialPostStatus}
            input={{ id: post.id, status: "draft" }}
          >
            Back to draft
          </ActionButton>
        </>
      )}
      {post.status === "published" ? (
        <ConfirmButton
          action={setSocialPostStatus}
          input={{ id: post.id, status: "archived" }}
          confirmLabel="Archive it"
          tone="plain"
        >
          <Archive size={11} />
          Archive
        </ConfirmButton>
      ) : (
        <ConfirmButton
          action={deleteSocialPost}
          input={{ id: post.id }}
          confirmLabel="Delete it"
        >
          <Trash2 size={11} />
          Delete
        </ConfirmButton>
      )}
    </div>
  );
}

/* ------------------------------------------------------ editing a campaign */

export type EditableCampaign = {
  id: string;
  name: string;
  channel: string;
  status: string;
  listingId: string | null;
};

export function EditCampaignButton({
  campaign,
  listings,
}: {
  campaign: EditableCampaign;
  listings: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateCampaign, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this draft">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit campaign">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: campaign.id,
            });
          }}
        >
          <Input
            label="Name"
            name="name"
            required
            defaultValue={campaign.name}
            errors={a.fieldErrors.name}
          />
          <Select
            label="Channel"
            name="channel"
            defaultValue={campaign.channel}
            options={[
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" },
            ]}
            errors={a.fieldErrors.channel}
          />
          <Select
            label="About a listing"
            name="listingId"
            defaultValue={campaign.listingId ?? ""}
            options={[{ value: "", label: "Not about a listing" }, ...listings]}
            errors={a.fieldErrors.listingId}
          />
          <p className="text-3 text-[11px] -mt-2">
            Only a draft can be edited. Once a campaign is in approval or has sent, its
            name and channel describe messages that already exist.
          </p>

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

/**
 * Delete or cancel, depending on whether anything has happened yet.
 *
 * The server decides which is allowed — a campaign with one `sent_at` or one
 * `blocked_reason` on it is evidence and refuses to be deleted. Both buttons are
 * offered so the refusal explains the difference rather than the button quietly not
 * being there.
 */
export function CampaignActions({ campaign }: { campaign: EditableCampaign }) {
  const draft = campaign.status === "draft";
  return (
    <div className="flex flex-wrap items-start gap-2">
      {draft && <DeleteCampaignButton id={campaign.id} />}
      {campaign.status !== "sent" && campaign.status !== "cancelled" && !draft && (
        <ConfirmButton
          action={cancelCampaign}
          input={{ id: campaign.id }}
          confirmLabel="Stop it"
          tone="plain"
          title="Stops the campaign, keeps every recipient row"
        >
          <X size={11} />
          Cancel
        </ConfirmButton>
      )}
    </div>
  );
}

export function DeleteCampaignButton({ id }: { id: string }) {
  return (
    <ConfirmButton action={deleteCampaign} input={{ id }} confirmLabel="Delete it">
      <Trash2 size={11} />
      Delete
    </ConfirmButton>
  );
}

/* ------------------------------------------------------ editing a proposal */

export type EditableProposal = {
  id: string;
  status: string;
  propertyId: string | null;
  estimateLow: number | null;
  estimateHigh: number | null;
};

export function EditProposalButton({
  proposal,
  properties,
}: {
  proposal: EditableProposal;
  properties: Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateProposal, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton onClick={() => { a.reset(); setOpen(true); }} title="Edit this proposal">
        <Pencil size={11} />
        Edit
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit proposal">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            a.run({
              ...Object.fromEntries(new FormData(e.currentTarget).entries()),
              id: proposal.id,
            });
          }}
        >
          <Select
            label="Property"
            name="propertyId"
            defaultValue={proposal.propertyId ?? ""}
            options={[{ value: "", label: "Not linked to a property yet" }, ...properties]}
            errors={a.fieldErrors.propertyId}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Estimate from"
              name="estimateLow"
              type="number"
              min="0"
              defaultValue={proposal.estimateLow ?? ""}
              errors={a.fieldErrors.estimateLow}
            />
            <Input
              label="Estimate to"
              name="estimateHigh"
              type="number"
              min="0"
              defaultValue={proposal.estimateHigh ?? ""}
              errors={a.fieldErrors.estimateHigh}
            />
          </div>
          <p className="text-3 text-[11px] -mt-2">
            A range, never a single number — and either both figures or neither. A low
            with no high reads as a promise, which is what under-quoting provisions
            exist to catch.
          </p>

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

/**
 * What can happen to a proposal, given where it is.
 *
 * A draft goes to the approval queue and nowhere else — there is no action anywhere
 * that sets `sent` from this screen, because a document with a price estimate on it
 * goes out under the agency's name (rule 1). Won and lost only appear once it has
 * actually been sent, because an outcome before then is a claim about a conversation
 * that has not happened.
 */
export function ProposalActions({
  proposal,
  properties,
}: {
  proposal: EditableProposal;
  properties: Option[];
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      {proposal.status === "draft" && (
        <>
          <ActionButton
            action={submitProposalForApproval}
            input={{ id: proposal.id }}
            tone="primary"
          >
            <ShieldCheck size={11} />
            Send for approval
          </ActionButton>
          <EditProposalButton proposal={proposal} properties={properties} />
          <ConfirmButton
            action={deleteProposal}
            input={{ id: proposal.id }}
            confirmLabel="Delete it"
          >
            <Trash2 size={11} />
            Delete
          </ConfirmButton>
        </>
      )}
      {proposal.status === "in_approval" && (
        <Link
          href="/approvals"
          className="inline-flex items-center gap-1 text-[11.5px] px-2 min-h-7 rounded-md bg-[var(--accent)] text-white hover:opacity-90"
        >
          <ShieldCheck size={11} />
          Review in queue
        </Link>
      )}
      {proposal.status === "sent" && (
        <>
          <ActionButton
            action={setProposalOutcome}
            input={{ id: proposal.id, outcome: "won" }}
            tone="primary"
          >
            Won the listing
          </ActionButton>
          <ActionButton
            action={setProposalOutcome}
            input={{ id: proposal.id, outcome: "lost" }}
          >
            Lost it
          </ActionButton>
        </>
      )}
    </div>
  );
}

/* ------------------------------- drafting a campaign from a listing's matches */

/**
 * The "draft a campaign to these contacts" button on the listing screen.
 *
 * It creates a DRAFT with the matched contacts already on the recipient list, and
 * that is all it does. Seeding is not a decision to contact anybody: consent is
 * checked at the instant of sending (§7, rule 2), so a contact who unsubscribes
 * between now and then has to be ON the list in order to be blocked and logged.
 * Filtering them out here would make the block invisible.
 */
export function DraftCampaignForListingButton({
  listingId,
  address,
  matchCount,
}: {
  listingId: string;
  address: string;
  matchCount: number;
}) {
  const router = useRouter();
  const a = useAction(createCampaign, {
    onSuccess: () => router.push("/campaigns"),
  });

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={a.pending || matchCount === 0}
        onClick={() =>
          a.run({
            name: `${address} — matched buyers`,
            channel: "email",
            listingId,
            seedFromMatches: true,
          })
        }
        className={trigger + " disabled:opacity-60"}
      >
        <Users size={13} />
        {matchCount === 0
          ? "No matches to draft to yet"
          : `Draft a campaign to these ${matchCount} contacts`}
      </button>
      {a.error && (
        <span className="text-[11.5px] text-[#b02f2f] dark:text-[#f08a8a]">
          {a.error}
        </span>
      )}
    </div>
  );
}
