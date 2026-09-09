"use client";

import * as React from "react";
import type { FormDefinition, FormField } from "./definitions";

/**
 * One component that renders any of the enquiry forms and posts it to the CRM.
 *
 * ## The submit path
 *
 * On mount it GETs `/api/forms/[key]?form=<formName>` for two things it cannot make up:
 * a signed token, and the exact marketing consent wording for this form. The token is
 * pinned by hash to that wording, so posting different text than was displayed is
 * rejected. That is what makes the `consents` row evidence rather than an assertion.
 *
 * Then it POSTs the envelope the route accepts, which is `.strict()`: identity, message,
 * formName and the consent fields. The service-specific answers are composed into
 * `message` as "Question: Answer" lines, which is what lands in the immutable
 * `interactions` row and what the agent reads on the contact.
 *
 * ## Consent, and where this deliberately differs from the live site
 *
 * www.ozirealty.com.au has a single required checkbox that acknowledges the privacy
 * policy, and treats submitting as the whole consent story. Under the Spam Act a
 * *marketing* consent has to be separate, specific and voluntary: bundling it into a
 * required checkbox that also does something else is precisely the pattern that makes it
 * indefensible later.
 *
 * So there are two, and they do different jobs:
 *
 *   - the required one acknowledges the privacy policy and does NOT set marketingOptIn.
 *     It is a condition of handling the enquiry, which is legitimate.
 *   - the optional one is the marketing consent, carries the server's wording verbatim,
 *     and is the only thing that sets marketingOptIn.
 *
 * The adapter records a consent row only when the box was ticked AND the wording
 * travelled with it, so an unticked box is silence rather than consent. Someone can
 * always enquire without agreeing to marketing, which is the point.
 *
 * ## Failure behaviour
 *
 * If the token GET fails the form still renders, disabled, saying so and giving the
 * phone number, because a form that looks live and cannot submit is worse than one that
 * admits it. A 500 from the endpoint says the enquiry was NOT saved and to phone, rather
 * than showing a thank-you over a dropped lead.
 */

type Meta = { token: string; consentWording: string; formName: string };

export function EnquiryForm({
  definition,
  formKey,
  phone,
  phoneHref,
}: {
  definition: FormDefinition;
  formKey: string;
  phone: string;
  phoneHref: string;
}) {
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [metaFailed, setMetaFailed] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string | string[]>>({});
  const [optIn, setOptIn] = React.useState(false);
  const [privacy, setPrivacy] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  /** Timestamp of first render: the route enforces a minimum fill time. */
  const openedAt = React.useRef<number>(0);
  React.useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/forms/${formKey}?form=${encodeURIComponent(definition.formName)}`,
          { cache: "no-store" },
        );
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as Meta;
        if (!cancelled) setMeta(j);
      } catch {
        if (!cancelled) setMetaFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formKey, definition.formName]);

  const set = (id: string, v: string | string[]) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const toggle = (id: string, opt: string) =>
    setValues((prev) => {
      const cur = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      return { ...prev, [id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  /**
   * The extra answers, as readable lines. Identity fields are excluded because they
   * travel as their own envelope keys; repeating them in the body would duplicate them
   * on the interaction.
   */
  function composeMessage(): string {
    const lines: string[] = [];
    for (const f of definition.fields) {
      if (["firstName", "lastName", "email", "phone"].includes(f.id)) continue;
      const v = values[f.id];
      const text = Array.isArray(v) ? v.join(", ") : (v ?? "").toString().trim();
      if (!text) continue;
      lines.push(`${f.label}: ${text}`);
    }
    return [`${definition.title} (${definition.formName})`, "", ...lines].join("\n").trim();
  }

  function missingRequired(): FormField | null {
    for (const f of definition.fields) {
      if (!f.required) continue;
      const v = values[f.id];
      const empty = Array.isArray(v) ? v.length === 0 : !(v ?? "").toString().trim();
      if (empty) return f;
    }
    return null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!meta) return;

    const missing = missingRequired();
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    if (!privacy) {
      setError("Please acknowledge the privacy notice so we can handle your enquiry.");
      return;
    }

    setBusy(true);
    try {
      const r = await fetch(`/api/forms/${formKey}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: meta.token,
          website: "", // honeypot, left empty by a real browser
          firstName: (values.firstName ?? "") as string,
          lastName: (values.lastName ?? "") as string,
          email: (values.email ?? "") as string,
          phone: (values.phone ?? "") as string,
          message: composeMessage(),
          listingRef: null,
          formName: meta.formName,
          marketingOptIn: optIn,
          consentWording: meta.consentWording,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setDone(true);
        return;
      }
      if (r.status === 422 && j.fieldErrors) setFieldErrors(j.fieldErrors);
      setError(j.error ?? "Something went wrong. Please phone the office.");
    } catch {
      setError(
        `We could not send that. Please check your connection, or phone the office on ${phone}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="form-done" role="status">
        Thank you. Your enquiry has reached us and we will be in touch. If it is urgent,
        phone <a href={phoneHref}>{phone}</a>.
      </div>
    );
  }

  return (
    <form className="enq" onSubmit={submit} noValidate>
      <h2 className="enq-title">{definition.title}</h2>
      {definition.intro && <p className="enq-intro">{definition.intro}</p>}

      {metaFailed && (
        <p className="enq-error" role="alert">
          This form is temporarily unavailable. Please phone{" "}
          <a href={phoneHref}>{phone}</a> and we will take your details.
        </p>
      )}

      <div className="enq-grid">
        {definition.fields.map((f) => (
          <Field
            key={f.id}
            f={f}
            value={values[f.id]}
            errors={fieldErrors[f.id]}
            onText={(v) => set(f.id, v)}
            onToggle={(o) => toggle(f.id, o)}
          />
        ))}
      </div>

      {/*
        The honeypot. Hidden from sight and from assistive technology, and not a
        `display:none` input a modern bot skips: it is off-screen with tabIndex -1.
      */}
      <div className="enq-hp" aria-hidden="true">
        <label htmlFor={`website-${definition.slug}`}>Leave this empty</label>
        <input id={`website-${definition.slug}`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="enq-consent">
        <label className="enq-check">
          <input
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            required
          />
          <span>
            I have read the privacy notice and agree to OziRealty handling my details in
            order to respond to this enquiry. <b>Required</b>
          </span>
        </label>

        {/*
          Separate, optional, and the only thing that records a marketing consent. The
          wording is the server's, verbatim, because it is what the consent row stores as
          evidence of what was on screen.
        */}
        <label className="enq-check">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          <span>
            {meta?.consentWording ??
              "Send me property updates by email. You can unsubscribe at any time."}{" "}
            <b>Optional</b>
          </span>
        </label>
      </div>

      {error && (
        <p className="enq-error" role="alert">
          {error}
        </p>
      )}

      <button className="btn" type="submit" disabled={busy || !meta}>
        {busy ? "Sending…" : definition.submitLabel}
      </button>
    </form>
  );
}

function Field({
  f,
  value,
  errors,
  onText,
  onToggle,
}: {
  f: FormField;
  value: string | string[] | undefined;
  errors?: string[];
  onText: (v: string) => void;
  onToggle: (o: string) => void;
}) {
  const id = `f-${f.id}`;
  const cls = `enq-field${f.half ? " enq-field--half" : ""}`;

  if (f.kind === "radio" || f.kind === "checkbox") {
    const selected = Array.isArray(value) ? value : value ? [value as string] : [];
    return (
      <fieldset className={`${cls} enq-field--group`}>
        <legend>
          {f.label}
          {f.required && <span aria-hidden="true"> *</span>}
        </legend>
        <div className="enq-options">
          {f.options?.map((o) => (
            <label className="enq-opt" key={o}>
              <input
                type={f.kind}
                name={f.id}
                value={o}
                checked={selected.includes(o)}
                onChange={() => (f.kind === "radio" ? onText(o) : onToggle(o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className={cls}>
      <label htmlFor={id}>
        {f.label}
        {f.required && <span aria-hidden="true"> *</span>}
      </label>
      {f.kind === "textarea" ? (
        <textarea
          id={id}
          name={f.id}
          rows={3}
          placeholder={f.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onText(e.target.value)}
        />
      ) : (
        <input
          id={id}
          name={f.id}
          type={f.kind}
          placeholder={f.placeholder}
          autoComplete={
            f.id === "firstName"
              ? "given-name"
              : f.id === "lastName"
                ? "family-name"
                : f.id === "email"
                  ? "email"
                  : f.id === "phone"
                    ? "tel"
                    : "off"
          }
          value={(value as string) ?? ""}
          onChange={(e) => onText(e.target.value)}
        />
      )}
      {errors?.length ? <p className="enq-field-error">{errors[0]}</p> : null}
    </div>
  );
}
