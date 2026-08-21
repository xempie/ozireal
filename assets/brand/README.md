# Brand assets

Drop the existing Ozi Realty assets in here. Needed before **2B.3** (public shell); the
CRM ships on shadcn defaults and does not wait on this.

Commit vector sources and licence files. Do **not** commit large raw photography — put it
in S3 and note the bucket path below.

## What to put here

```
assets/brand/
  logo/
    ozi-realty.svg              primary, vector
    ozi-realty-mono.svg         single-colour, for dark backgrounds and favicons
    favicon-source.svg          square-safe mark, no wordmark
  colour/
    palette.md                  hex values, and which is primary/accent/neutral
  type/
    <font files or a note naming the webfont>
    LICENCE                     required — webfont licensing is per-domain and real
  photography/
    NOTES.md                    S3 path, and who took them / usage rights
```

## What I need told, not just given

- **Which colour is primary vs accent**, and any pairing that is off-limits. A palette
  without roles gets guessed at.
- **Font licence scope.** Self-hosting a font that is licensed desktop-only is a real
  problem, and it is the usual one.
- **Photography rights.** Agency-owned, photographer-licensed for web, or stock? Listing
  photography is normally shot per-campaign and belongs to the vendor's campaign, which is
  a different question from site furniture.
- **Anything on the current Wix site that must be kept**, and anything the business has
  been wanting to change. A rebuild is the cheap moment to fix it.

Once these land I derive the Tailwind theme and shadcn tokens for `(public)` from them.
The public theme stays separate from the CRM's — brand-led out front, dense and functional
inside.
