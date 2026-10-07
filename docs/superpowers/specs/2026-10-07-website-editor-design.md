# Website editor via chat — design

Approved 2026-10-07. Scope decisions: text + added blocks on existing pages; draft →
preview → publish with history; theme settings + per-block styles (no raw CSS).

## Model

`site_content` (migration 0019), one row per path per version, RLS on `tenant_id`:
`path` (`/about-adelaide-land-agent`, `/first-home-buyers`, or `@theme`), `version`,
`status` (`draft` | `published` | `archived`), `doc` jsonb, `note`, `created_by`,
`created_at`, `published_at`. At most one draft and one published row per path.

`doc` is validated by Zod in `src/lib/site-content.ts` (pure, shared):

- **Page doc**: `meta {title, description}` (new pages), `hero` text overrides
  (`eyebrow, title, titleEm, lede`), `service` overrides for service pages
  (`points`, `sections`), `blocks[]` each `{id, zone: "after_hero" | "end", type,
  props, style}`, `deleted` (new pages only).
- **Block types**: `hero` (new pages), `text`, `image`, `cta`, `form`, `faq`,
  `cards`, `listings`. Images from a fixed gallery of known-good photos. Links are
  internal paths, `https:`, `tel:` or `mailto:` only. No HTML anywhere.
- **Style**: `background` (default/paper/dark/accent), `align` (left/center),
  `spacing` (tight/normal/loose).
- **Theme doc**: `accent`, `ink`, `paper` (hex), `fontPair`, `buttonShape`.

## Rendering

- Public reads go through `src/server/public/content.ts` (rule 8): published doc, or
  the draft when Next draft mode is on.
- Middleware forwards the path as `x-pathname`; `PageHero`, `ServicePageBody`, the
  home page and the layout read overrides and zones for that path. Public pages
  render dynamically so a publish is live at once.
- New pages: `(public)/[...slug]/page.tsx` renders published page docs; reserved and
  built-in paths are refused when a page is created.
- Theme: layout writes CSS variables from the theme doc.

## Editing

- CRM Website section lists pages with status; Preview (enables draft mode via
  `/api/website/preview`), Publish, Discard draft, History → Restore.
- Assistant tools: reads `website_list_pages`, `website_get_page`; writes
  `website_create_page`, `website_add_block`, `website_update_block`,
  `website_remove_block`, `website_set_text`, `website_set_theme`,
  `website_delete_page`, `website_publish`. Writes are Do it / Cancel cards and
  save drafts through Server Actions (Zod + audit).
- Locked: `/privacy`, `/terms`, `/complaints`. Listings and prices not editable here.
