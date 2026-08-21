# Legacy site inventory — ozirealty.com.au

Captured 2026-08-17 from the live sitemaps. Input for the Phase 2B redirect map
(item 2B.0). Re-capture immediately before cutover — the blog is actively published, so
this list will have grown.

## Platform

**Wix.** Identified from the sitemap index: `booking-services-sitemap.xml`,
`blog-posts-sitemap.xml`, `blog-categories-sitemap.xml`, and a
`dynamic-properties_p_<guid>_0_5000-sitemap.xml` collection sitemap. That means:

- Content lives in Wix CMS collections and Wix Blog. Both export to CSV; media has to be
  pulled separately.
- **Wix Bookings is in use** (`/book-online` + a booking-services sitemap). That is a
  live lead-capture path. If the new site launches without a replacement, an existing
  source of appointments silently disappears at cutover.
- Nothing is portable as code. This is a content migration, not a port.

## Canonical host is `www`

Every sitemap URL is `https://www.ozirealty.com.au/...`. Indexed equity is on `www`, so:

- **Public site: `www.ozirealty.com.au`.** Apex 301s to `www`.
- **CRM: `app.ozirealty.com.au`.**
- **Inbound mail: `in.ozirealty.com.au`** (MX → SES). Apex MX is untouched, so the
  agency's existing email keeps working through the whole migration.

This corrects the earlier plan of serving the public site from the apex. Do not flip the
canonical host during a migration — it doubles the redirect risk for no gain.

## Inventory

| Type | Count | URL pattern |
|---|---|---|
| Standard pages | 22 | `/<slug>` |
| Blog posts | 51 | `/post/<slug>` |
| Blog categories | ? | `/blog/categories/<slug>` (fetch before cutover) |
| Property pages | 4 | `/properties/<street-address-slug>` |
| Booking services | ? | Wix Bookings paths (fetch before cutover) |

Blog `lastmod` range: 2025-01-24 → 2026-08-17. It is published to actively.

### Standard pages (22)

```
/                                        home
/about-adelaide-land-agent
/property-services
/property-strategy-services
/manage-property-adelaide                property management (see note)
/rent-out-my-property-adelaide           property management (see note)
/rent-property-house-adelaide            rentals — tenant side
/property-rental-report
/sell-property-house-adelaide
/buyer-agent-adelaide                    buyer's agency
/property-investment
/oversees-investment                     typo in slug ("overseas")
/land-opportunities-sa-adelaide
/sell-my-business-australia              business brokerage
/free-property-appraisal-sa              lead form
/free-suburb-insight-report              lead form
/adelaide-property-faq
/realestate-gift-adelaide
/inquiry-services-page
/book-online                             Wix Bookings
/contact-adelaide-realestae-agency       typo in slug ("realestae")
/blog
```

### Property pages (4)

```
/properties/8-weerana-road
/properties/11-berry-fry-avenue
/properties/12-powell-street
/properties/greenacres
```

Four listings only, so there is no meaningful stock import — D8 (no import) holds. Re-key
them by hand into `properties` + `listings` during 2B.4.

Note the new slug scheme in §16 is
`/for-sale/12-smith-street-norwood-sa-5067-1234`, which does not match `/properties/<x>`.
Four 301s. Trivial, but they must exist.

### Blog posts (51)

Pattern `/post/<slug>`. **Keep this pattern.** Our blog can serve `/post/<slug>` as well
as anything else, and preserving 51 URLs verbatim is worth far more than a tidier path.
Full list is in the live `blog-posts-sitemap.xml`; re-pull at migration time rather than
freezing a copy here.

## Redirect rules

1. `http://*` → `https://www.*` (Caddy).
2. `ozirealty.com.au/*` → `www.ozirealty.com.au/*`, 301, path preserved.
3. `/post/<slug>` → same path. No redirect needed if we adopt the pattern.
4. `/properties/<slug>` → new listing URL, 301, per-listing map. 4 entries.
5. The 22 standard pages → 1:1 where the new site has an equivalent. Every one needs a
   destination decided **before** launch; a page with no equivalent goes to the nearest
   parent, never to the home page and never to a 404.
6. Fix the two typo slugs on the new site (`/overseas-investment`,
   `/contact`), 301 from the old spelling. Never drop the old URL.
7. Wix appends query junk (`?lang=`, tracking params) on some paths — ignore query
   strings when matching redirects.

## Migration risks

**The blog is live and being written to.** Someone published to it today. Pick a content
freeze window, migrate, verify, cut over. Posts written during migration and missed are
the classic way content is lost.

**Wix Bookings has no equivalent in the plan yet.** `/book-online` currently takes real
appointments. Phase 3 builds the calendar (3.1, 3.7) but Phase 2B does not build public
booking. Either 2B ships an inspection/appraisal booking form that writes to
`calendar_events`, or `/book-online` keeps pointing at Wix until Phase 3 lands. Decide
before cutover — this is a working revenue path.

**Search Console before, not after.** Verify the domain, capture current
performance and the top-page list ahead of cutover so a ranking drop afterwards is
measurable rather than a matter of opinion. Submit the new sitemap at cutover.

## Two spec gaps this inventory exposes

The live site sells more than CLAUDE.md §1 describes:

1. **Property management.** Four pages market it (`/manage-property-adelaide`,
   `/rent-out-my-property-adelaide`, `/property-rental-report`, and part of
   `/property-services`). The platform decision is advertise-only, no management (D10).
   Those pages can stay as lead-generation — leads land in the contact list like any
   other — but the platform will not run leases, ledgers or routine inspections. Worth
   confirming the business is comfortable marketing a service the CRM does not
   administer.
2. **Buyer's agency, overseas investment, land opportunities, and business brokerage.**
   `/buyer-agent-adelaide`, `/oversees-investment`, `/land-opportunities-sa-adelaide`,
   `/sell-my-business-australia`. These imply contact roles beyond
   buyer/vendor/landlord/tenant/referrer (§4) — at minimum *investor* and
   *business vendor*. `contact_roles` is a join table, so this is seed data rather than a
   migration, but the matching engine (§6) assumes residential property preferences and
   has nothing to say about a business sale. Out of scope for now; noted so it is a
   decision rather than an oversight.
