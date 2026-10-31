import { z } from "zod";
import { FORMS } from "@/components/public/forms/definitions";
import { PRIVATE_PREFIXES } from "@/lib/private-paths";

/**
 * What website content may contain, in one place.
 *
 * Every doc in site_content is parsed with these schemas before it is written (the
 * Server Actions) and again before it is rendered (src/server/public/content.ts), so
 * a doc that does not fit is never shown. There is no HTML anywhere in a doc: every
 * block is plain text rendered by our own components, links are restricted to safe
 * schemes, and images come from a fixed gallery, so nothing the assistant writes can
 * inject markup or point the site at an arbitrary host.
 */

/* ------------------------------------------------------------- gallery */

/** Photos already used on the site, so every one is known to load. Unsplash ids. */
export const GALLERY = {
  "photo-1600596542815-ffad4c1539a9": "White rendered home under a blue sky",
  "photo-1605146769289-440113cc3d00": "Grey and white contemporary home",
  "photo-1568605114967-8130f3a36994": "Character home in Prospect",
  "photo-1615873968403-89e068629265": "Living room with a tan leather sofa against a dark green wall",
  "photo-1628624747186-a941c476b7ef": "Investment property with established gardens",
  "photo-1600210491892-03d54c0aaf87": "Apartment living room with a fireplace",
  "photo-1598228723793-52759bba239c": "Brick home framed by green trees",
  "photo-1605276374104-dee2a0ed3cd6": "Suburban house exterior",
  "photo-1598928506311-c55ded91a20c": "Living room with a marble fireplace",
  "photo-1583847268964-b28dc8f51f92": "Living room with a large window",
  "photo-1570129477492-45c003edd2be": "Sandstone villa with a return verandah",
  "photo-1512917774080-9991f1c4c750": "Waterfront apartment building",
  "photo-1600607687939-ce8a6c25118c": "Meeting room in a small business",
  "photo-1584738766473-61c083514bf4": "Established block with mature trees",
  "photo-1580587771525-78b9dba3b914": "Terrace homes on a leafy street",
  // Ordinary Australian suburban homes, added 2026-10-29 for the projects page.
  "photo-1782511295240-2d55c11776ec": "Single-storey brick home with a garage",
  "photo-1720175328600-06f71cee36c4": "Suburban house with a blue roof",
  "photo-1777105986341-9677da85607e": "Row of modern townhouses behind a fence",
  "photo-1777104631979-d57208fa7cf7": "Row of garages with solar panels above",
  "photo-1772325434696-14473ee3b53b": "New housing estate from above",
  "photo-1781231444047-3736480fa5f9": "Small apartment building among trees",
  "photo-1720175338668-2e96d090d780": "Weatherboard house behind a white picket fence",
  "photo-1733639516571-575618028339": "Brick bungalow with a bay window",
  "photo-1777104623084-1b36260d1577": "Row of new townhouses with dark roofs",
  "photo-1579678929710-862f8e01c0b2": "Two-storey brick houses on a suburban street",
  "photo-1720175356041-6b1c963e0075": "Californian bungalow with a front garden",
  "photo-1600645174997-bea67efe2fd1": "Two-storey townhouse with timber cladding",
  "photo-1666000346172-8e7e87547d2a": "Brick house behind a white picket fence",
  "photo-1598249467153-963a1ef910cf": "House with a green roof among trees",
  // Brand-new homes, added 2026-10-31 for the projects page.
  "photo-1692133188474-8c5591e6a6a8": "New single-storey home with a double garage",
  "photo-1666004095305-300183c896ed": "New brick and glass home",
  "photo-1647579350413-a6ada4e480ed": "New two-storey family home with garages",
  "photo-1662505899914-1000c566477b": "New white two-storey home",
  "photo-1771366260867-7e07094579d7": "New white home with a glass garage door",
  "photo-1771558969707-45e93dfd2570": "New two-storey rendered home",
  "photo-1785554330278-5e1b24c73832": "New home with cladding and render",
  "photo-1631458325834-8f678e48912c": "Entrance of a new home",
  "photo-1769780510442-60d4d6391a91": "New home at dusk",
  "photo-1789683024055-eeb663e30036": "New home with a stone feature wall",
} as const;
export const IMAGE_IDS = Object.keys(GALLERY) as [keyof typeof GALLERY, ...(keyof typeof GALLERY)[]];

/* --------------------------------------------------------------- paths */

/** Built-in public pages. Their layout is code; text and added blocks are editable. */
export const BUILTIN_PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/all-listings", label: "Every listing" },
  { path: "/for-sale", label: "For sale" },
  { path: "/sold", label: "Sold and leased" },
  { path: "/suburbs", label: "Suburbs" },
  { path: "/property-services", label: "Services" },
  { path: "/property-strategy-services", label: "Strategy services" },
  { path: "/overseas-investment", label: "Overseas investment" },
  { path: "/free-property-appraisal-sa", label: "Free appraisal" },
  { path: "/free-suburb-insight-report", label: "Suburb insight report" },
  { path: "/property-rental-report", label: "Rental report" },
  { path: "/manage-property-adelaide", label: "Property management" },
  { path: "/sell-property-house-adelaide", label: "Sell my property" },
  { path: "/rent-property-house-adelaide", label: "Rent a property" },
  { path: "/buyer-agent-adelaide", label: "Buyer agent" },
  { path: "/property-investment", label: "Property investment" },
  { path: "/land-opportunities-sa-adelaide", label: "Land opportunities" },
  { path: "/sell-my-business-australia", label: "Sell my business" },
  { path: "/about-adelaide-land-agent", label: "About" },
  { path: "/contact", label: "Contact" },
  { path: "/book-online", label: "Free meeting" },
  { path: "/blog", label: "Blog" },
  { path: "/adelaide-property-faq", label: "FAQ" },
  { path: "/privacy", label: "Privacy policy" },
  { path: "/terms", label: "Terms of use" },
  { path: "/complaints", label: "Complaints" },
];

/** Legal text is written and reviewed by a person, never edited through the assistant. */
export const LOCKED_PATHS = ["/privacy", "/terms", "/complaints"];

/** The theme lives under a path no URL can have. */
export const THEME_PATH = "@theme";

const RESERVED_PREFIXES = [
  ...PRIVATE_PREFIXES,
  "/api",
  "/login",
  "/post",
  "/blog",
  "/suburbs",
  "/all-listings",
  "/for-sale",
  "/sold",
  "/brand",
  "/_next",
];

export const isBuiltinPath = (p: string) => BUILTIN_PAGES.some((b) => b.path === p);

/** A new page's address: lower-case words joined by hyphens, one or two segments. */
const PATH_RE = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/** Why a path cannot be a NEW page, or null when it can. */
export function newPagePathProblem(p: string): string | null {
  if (!PATH_RE.test(p) || p.length > 80)
    return "Use lower-case words joined by hyphens, like /first-home-buyers.";
  if (isBuiltinPath(p)) return `${p} is already a page on the site. Edit it instead.`;
  if (RESERVED_PREFIXES.some((r) => p === r || p.startsWith(r + "/")))
    return `${p} is reserved by the site or the CRM.`;
  return null;
}

/* -------------------------------------------------------------- pieces */

const t = (max: number) => z.string().trim().min(1).max(max);

const SAFE_HREF = /^(\/[a-z0-9\-/#?=&_.]*|https:\/\/[^\s"'<>]+|tel:[+\d\s]+|mailto:[^\s"'<>]+)$/i;
const href = z.string().trim().max(300).regex(SAFE_HREF, "Use a page path like /contact, an https:// link, tel: or mailto:.");

const style = z
  .object({
    background: z.enum(["default", "paper", "dark", "accent"]).optional(),
    align: z.enum(["left", "center"]).optional(),
    spacing: z.enum(["tight", "normal", "loose"]).optional(),
  })
  .strict();

const FORM_SLUGS = FORMS.map((f) => f.slug) as [string, ...string[]];

export const ZONE_RE = /^(after_hero|end|(before|after):[a-z0-9-]{2,40})$/;

/**
 * The block types, built for a given id rule: required when stored, optional when the
 * assistant proposes a new block (the action assigns one).
 */
function blockOptions<I extends z.ZodTypeAny>(id: I) {
  const base = {
    id,
    /**
     * Built-in pages only: straight after the hero, at the end of the page, or before /
     * after one of the page's built-in sections ("before:why-us", "after:form").
     */
    zone: z.string().regex(ZONE_RE, "Use after_hero, end, before:<section id> or after:<section id>.").optional(),
    style: style.optional(),
  };
  return [
    z.object({
      ...base,
      type: z.literal("hero"),
      eyebrow: t(60).optional(),
      title: t(120),
      titleEm: t(120).optional(),
      lede: t(400).optional(),
      image: z.enum(IMAGE_IDS),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("text"),
      eyebrow: t(60).optional(),
      heading: t(160).optional(),
      headingEm: t(120).optional(),
      paragraphs: z.array(t(2000)).max(12).default([]),
      bullets: z.array(t(300)).max(16).optional(),
      /**
       * Price wording for a project card, rendered verbatim (CLAUDE.md §16: the agent writes
       * the price display, the site never formats a number into one).
       */
      price: t(60).optional(),
      /*
        Project finder fields (projects page). priceMin/priceMax are numbers used ONLY to
        filter and sort; the card always shows `price` verbatim (CLAUDE.md §16).
      */
      area: t(60).optional(),
      kind: t(40).optional(),
      ready: z.boolean().optional(),
      priceMin: z.number().int().positive().optional(),
      priceMax: z.number().int().positive().optional(),
      /** Short key facts, shown as pills over the photo when the block is a project card. */
      highlights: z.array(t(60)).max(4).optional(),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("image"),
      image: z.enum(IMAGE_IDS),
      alt: t(200),
      caption: t(300).optional(),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("cta"),
      heading: t(160),
      headingEm: t(120).optional(),
      label: t(60),
      href,
    }).strict(),
    z.object({
      ...base,
      type: z.literal("form"),
      form: z.enum(FORM_SLUGS),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("faq"),
      heading: t(160).optional(),
      items: z.array(z.object({ q: t(300), a: t(2000) }).strict()).min(1).max(20),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("cards"),
      heading: t(160).optional(),
      items: z
        .array(
          z
            .object({
              title: t(120),
              /** Short line under the title, e.g. a phrase quoted from a review. */
              highlight: t(120).optional(),
              body: t(600),
              href: href.optional(),
            })
            .strict(),
        )
        .min(1)
        .max(6),
    }).strict(),
    z.object({
      ...base,
      type: z.literal("listings"),
      heading: t(160).optional(),
      show: z.enum(["on_market", "sold"]),
      limit: z.number().int().min(1).max(12),
    }).strict(),
  ] as const;
}

const blockId = z.string().regex(/^[a-z0-9-]{3,40}$/);
export const SECTION_ID_RE = /^[a-z0-9-]{2,40}$/;
export const BlockSchema = z.discriminatedUnion("type", blockOptions(blockId));
/** What the assistant proposes: the same, with the id left to the server. */
export const BlockInputSchema = z.discriminatedUnion("type", blockOptions(blockId.optional()));
export type Block = z.infer<typeof BlockSchema>;

export const HeroTextSchema = z
  .object({
    eyebrow: t(80).optional(),
    title: t(160).optional(),
    titleEm: t(160).optional(),
    lede: t(600).optional(),
  })
  .strict();
export type HeroText = z.infer<typeof HeroTextSchema>;

export const ServiceTextSchema = z
  .object({
    points: z.array(t(300)).min(1).max(12).optional(),
    sections: z
      .array(z.object({ heading: t(160), body: z.array(t(2000)).min(1).max(8) }).strict())
      .min(1)
      .max(8)
      .optional(),
  })
  .strict();

export const PageDocSchema = z
  .object({
    meta: z.object({ title: t(70).optional(), description: t(170).optional() }).strict().optional(),
    hero: HeroTextSchema.optional(),
    service: ServiceTextSchema.optional(),
    blocks: z.array(BlockSchema).max(120).default([]),
    /** Built-in sections hidden on this page, by their <Fixed> id. */
    hidden: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(40).optional(),
    /** A new page taken down. Built-in pages cannot be deleted. */
    deleted: z.boolean().optional(),
  })
  .strict();
export type PageDoc = z.infer<typeof PageDocSchema>;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex colour like #D84315.");

export const ThemeDocSchema = z
  .object({
    accent: hex.optional(),
    ink: hex.optional(),
    paper: hex.optional(),
    fontPair: z.enum(["classic", "modern", "editorial"]).optional(),
    buttonShape: z.enum(["square", "rounded", "pill"]).optional(),
  })
  .strict();
export type ThemeDoc = z.infer<typeof ThemeDocSchema>;

export const EMPTY_PAGE: PageDoc = { blocks: [] };

/* --------------------------------------------------------------- theme */

function shade(hexColour: string, amount: number): string {
  const n = parseInt(hexColour.slice(1), 16);
  const mix = (c: number) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * The theme as CSS. Safe to inline: every value is a validated hex colour or a fixed
 * string chosen here, never text from the doc.
 */
export function themeCss(raw: unknown): string {
  const parsed = ThemeDocSchema.safeParse(raw);
  if (!parsed.success) return "";
  const th = parsed.data;
  const vars: string[] = [];
  if (th.accent) {
    vars.push(`--accent:${th.accent}`, `--accent-dp:${shade(th.accent, -0.2)}`, `--accent-lt:${shade(th.accent, 0.3)}`);
  }
  if (th.ink) {
    vars.push(`--ink:${th.ink}`, `--ink-2:${shade(th.ink, 0.06)}`, `--ink-3:${shade(th.ink, 0.14)}`);
  }
  if (th.paper) vars.push(`--paper:${th.paper}`, `--paper-2:${shade(th.paper, 0.4)}`);
  if (th.fontPair === "modern") vars.push("--serif:var(--font-body),-apple-system,'Segoe UI',sans-serif");
  if (th.fontPair === "editorial") vars.push("--sans:var(--font-display),Georgia,serif");

  let css = vars.length ? `.site{${vars.join(";")}}` : "";
  const radius = th.buttonShape === "rounded" ? "8px" : th.buttonShape === "pill" ? "999px" : null;
  if (radius) css += `.site .btn{border-radius:${radius}}`;
  return css;
}

/** A short, unique-enough block id. */
export const newBlockId = () => "b-" + Math.random().toString(36).slice(2, 10);
