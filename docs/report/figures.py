"""
Figures for the OziRealty platform specification report.

Renders every diagram and chart to docs/report/figures/*.png at 200 dpi, sized to the
A4 text column (17 cm / 6.7 in) so type inside the figures matches the document's body
size — no downscaling, no 5pt labels.

Palette is the validated light-mode categorical set:
  node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100,#e87ba4,#008300" \
       --mode light
  -> all checks pass. Contrast WARN on aqua / yellow / magenta against the light
     surface, so the relief rule applies: every mark carries a visible direct label and
     no meaning is ever carried by fill colour alone.

Run:  python figures.py
"""

import os
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Polygon
from matplotlib.colors import to_rgb

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- design tokens
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
HAIR = "#e1e0d9"
BASE = "#c3c2b7"

S1 = "#2a78d6"  # blue     — contacts / core
S2 = "#eb6834"  # orange   — inbound channels
S3 = "#1baf7a"  # aqua     — stock / property
S4 = "#eda100"  # yellow   — queues and human gates
S5 = "#e87ba4"  # magenta  — public website
S6 = "#008300"  # green    — sent / complete
S7 = "#4a3aa7"  # violet   — AI surfaces
S8 = "#e34948"  # red      — blocked

CRIT = "#d03b3b"

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.sans-serif": ["Segoe UI", "Calibri", "DejaVu Sans"],
        "figure.facecolor": SURFACE,
        "savefig.facecolor": SURFACE,
        "savefig.dpi": 200,
        "text.color": INK,
    }
)

W_IN = 6.7          # A4 text column
LINE_STEP = 2.15    # vertical pitch of a field line, in canvas units
HEAD_PAD = 7.0      # box height needed for a title + one field line


def tint(hexcolor, f):
    r, g, b = to_rgb(hexcolor)
    return (r + (1 - r) * f, g + (1 - g) * f, b + (1 - b) * f)


def h_for(nlines):
    """Minimum box height that fits a title rule plus nlines field lines."""
    return HEAD_PAD + LINE_STEP * max(0, nlines - 1)


def canvas(h_in, w_in=W_IN):
    """Canvas where 1 data unit = 0.1 inch, origin bottom-left."""
    fig = plt.figure(figsize=(w_in, h_in))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w_in * 10)
    ax.set_ylim(0, h_in * 10)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig, ax


def box(ax, cx, cy, w, title, h=None, hue=S1, lines=None, fs=7.5, tfs=8.4,
        lw=1.3, ls="-", fill=None, zorder=3):
    """Rounded node. With `lines`, height is auto-sized so fields can never overflow."""
    if lines:
        h = max(h or 0, h_for(len(lines)))
    else:
        h = h or 5.2
    ax.add_patch(
        FancyBboxPatch(
            (cx - w / 2, cy - h / 2), w, h,
            boxstyle="round,pad=0,rounding_size=1.1",
            linewidth=lw, edgecolor=hue,
            facecolor=fill if fill else tint(hue, 0.90),
            linestyle=ls, zorder=zorder,
        )
    )
    if lines:
        ax.text(cx, cy + h / 2 - 2.1, title, ha="center", va="center",
                fontsize=tfs, color=INK, fontweight="bold", zorder=zorder + 1)
        ax.plot([cx - w / 2 + 1.5, cx + w / 2 - 1.5],
                [cy + h / 2 - 3.6, cy + h / 2 - 3.6],
                color=tint(hue, 0.45), lw=0.8, zorder=zorder + 1)
        y = cy + h / 2 - 5.5
        for ln in lines:
            ax.text(cx - w / 2 + 1.7, y, ln, ha="left", va="center",
                    fontsize=fs, color=INK2, zorder=zorder + 1)
            y -= LINE_STEP
    else:
        ax.text(cx, cy, title, ha="center", va="center", fontsize=tfs, color=INK,
                fontweight="bold", zorder=zorder + 1, linespacing=1.35)
    return h


def diamond(ax, cx, cy, w, h, title, hue=S4, fs=7.6):
    ax.add_patch(Polygon([(cx, cy + h / 2), (cx + w / 2, cy), (cx, cy - h / 2),
                          (cx - w / 2, cy)],
                         closed=True, linewidth=1.3, edgecolor=hue,
                         facecolor=tint(hue, 0.90), zorder=3))
    ax.text(cx, cy, title, ha="center", va="center", fontsize=fs, color=INK,
            fontweight="bold", zorder=4, linespacing=1.35)


def arrow(ax, p0, p1, color=MUTED, lw=1.4, rad=0.0, label=None, ls="-",
          lfs=6.7, lpos=0.5, ldx=0.0, ldy=1.6, lcolor=None, ha="center",
          double=False, zorder=2):
    ax.add_patch(
        FancyArrowPatch(p0, p1, arrowstyle="<|-|>" if double else "-|>",
                        mutation_scale=8.5, linewidth=lw, color=color, linestyle=ls,
                        connectionstyle=f"arc3,rad={rad}", shrinkA=1.5, shrinkB=1.5,
                        zorder=zorder)
    )
    if label:
        mx = p0[0] + (p1[0] - p0[0]) * lpos + ldx
        my = p0[1] + (p1[1] - p0[1]) * lpos + ldy
        ax.text(mx, my, label, ha=ha, va="center", fontsize=lfs,
                color=lcolor or MUTED, zorder=zorder + 1, linespacing=1.3)


def caption(ax, x, y, text, fs=6.8, color=MUTED, ha="left"):
    ax.text(x, y, text, ha=ha, va="center", fontsize=fs, color=color,
            style="italic", linespacing=1.4)


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, pad_inches=0)
    plt.close(fig)
    print("wrote", os.path.relpath(path, HERE))


# =============================================================== F1 system map
def f1_system_map():
    fig, ax = canvas(5.6)

    box(ax, 33.5, 50, 26, "Public website\nwww.ozirealty.com.au", h=6.4, hue=S5, tfs=8.4)
    box(ax, 33.5, 33, 19, "THE CONTACT LIST\nwho they are · what they\nwant · what happened\nlast time",
        h=9.6, hue=S1, tfs=8.2)
    box(ax, 33.5, 13, 21, "PROPERTY & LISTINGS\nthe stock the agency controls",
        h=6.4, hue=S3, tfs=8.0)

    chans = ["Website forms", "Email  (SES)", "SMS replies", "Social messages",
             "Walk-in / phone\nmanual + voice note"]
    ys = [45, 39, 33, 27, 20.5]
    for name, y in zip(chans, ys):
        box(ax, 9.5, y, 15, name, h=4.8, hue=S2, tfs=7.5)
        arrow(ax, (17.2, y), (23.8, 33.3), rad=0.05)

    surfaces = ["Matching engine", "Approval queue\nthe human gate",
                "Compliance advisor", "Content, social & SEO", "Proposal generator"]
    for name, y, hue in zip(surfaces, ys, [S3, S4, S7, S7, S7]):
        box(ax, 57.5, y, 17, name, h=4.8, hue=hue, tfs=7.5)
        arrow(ax, (43.2, 33.3), (48.9, y), rad=-0.05)

    arrow(ax, (30, 28.2), (30, 16.3), double=True, color=BASE,
          label="matched\nboth ways", ldx=-4.4, ldy=0, lfs=6.5, ha="right")
    arrow(ax, (44, 14.0), (46.5, 46.7), color=S3, lw=1.2, rad=-0.05)
    caption(ax, 48.0, 12.0, "live listings\nfeed the website", color=S3, fs=6.5)
    arrow(ax, (28, 46.7), (28, 38.0), color=S5, lw=1.2)
    caption(ax, 26.6, 42.5, "enquiries", color=S5, fs=6.5, ha="right")

    arrow(ax, (66.4, 36.6), (66.4, 8.5), color=S4, lw=1.2, ls=(0, (3, 2)))
    caption(ax, 64.8, 5.6,
            "Every outbound message — email, SMS, social post, article —\n"
            "leaves only through the approval queue.",
            ha="right", color=INK2, fs=6.9)
    save(fig, "f1-system-map.png")


# ========================================================== F2 ingest pipeline
def f2_pipeline():
    fig, ax = canvas(2.9)
    steps = [("Channel\nadapter", S2), ("Normalise", S2), ("Identity\nresolve", S1),
             ("Interaction row\nappend-only", S1), ("AI summarise\nHaiku", S7),
             ("Rolling brief\nSonnet", S7)]
    w, gap = 9.4, 1.9
    ys = 19.5
    cxs = []
    for i, (name, hue) in enumerate(steps):
        cx = 1.2 + w / 2 + i * (w + gap)
        cxs.append(cx)
        box(ax, cx, ys, w, name, h=6.6, hue=hue, tfs=7.3)
        if i:
            arrow(ax, (cx - w / 2 - gap + 0.4, ys), (cx - w / 2 - 0.4, ys))

    box(ax, cxs[2], 6.6, 13, "Merge review queue", h=4.6, hue=S4, tfs=7.3)
    arrow(ax, (cxs[2], ys - 3.4), (cxs[2], 8.9), color=S4)
    caption(ax, cxs[2] - 7.2, 12.5, "ambiguous", color=S4, fs=6.5, ha="right")
    box(ax, cxs[5], 6.6, 13, "Confirm queue", h=4.6, hue=S4, tfs=7.3)
    arrow(ax, (cxs[5], ys - 3.4), (cxs[5], 8.9), color=S4)
    caption(ax, cxs[5] + 1.2, 12.5, "tasks &\npreferences", color=S4, fs=6.5)

    caption(ax, 1.2, 1.8,
            "One pipeline, every channel. Adding a channel means adding one adapter — "
            "the pipeline itself is never edited.")
    save(fig, "f2-ingest-pipeline.png")


# ============================================================ F3 approval gate
def f3_approval():
    fig, ax = canvas(3.9)
    box(ax, 9.5, 31, 15, "AI drafts a\nmessage", h=5.6, hue=S7, tfs=7.8)
    box(ax, 31, 31, 18, "Approval queue\npending review", h=5.6, hue=S4, tfs=7.8)
    diamond(ax, 54, 31, 19, 11, "Consent still\nvalid at this\nmoment?", S4, fs=7.4)

    box(ax, 12, 17, 17, "Agent edits,\nrejects, or approves", h=5.2, hue=S4, tfs=7.8)
    box(ax, 36, 15, 15, "Sent", h=5.2, hue=S6, tfs=8.6)
    box(ax, 57, 15, 16, "Blocked, and logged", h=5.2, hue=S8, tfs=7.8)

    arrow(ax, (17.2, 31), (21.9, 31))
    arrow(ax, (40.1, 31), (44.3, 31))
    caption(ax, 42.2, 34.6, "approved by\na human", color=INK2, fs=6.6, ha="center")
    arrow(ax, (25, 28.3), (15, 19.7), color=MUTED)
    arrow(ax, (48.5, 27.2), (37.5, 17.7), color=S6, label="yes", ldx=-2.6, ldy=1.0,
          lfs=6.9, lcolor=S6)
    arrow(ax, (59.5, 27.2), (57.4, 17.7), color=S8, label="no", ldx=1.9, ldy=0,
          lfs=6.9, lcolor=S8)

    caption(ax, 1.2, 7.4,
            "There is no autonomous send path, and no setting that creates one.",
            color=INK2)
    caption(ax, 1.2, 3.8,
            "Consent is re-checked at the instant of sending, not when the draft was "
            "written — so someone who unsubscribes\nin between does not receive the "
            "message. That is what makes a send defensible under the Spam Act.")
    save(fig, "f3-approval-gate.png")


# ============================================================== F4 ERD people
def f4_erd_people():
    fig, ax = canvas(6.5)

    box(ax, 33.5, 57, 21, "tenants", hue=S1,
        lines=["the agency · licence no. · jurisdiction"], tfs=8.2, fs=7.0)

    box(ax, 33.5, 35, 24, "contacts", hue=S1, tfs=9.2,
        lines=["id · tenant_id", "first_name · last_name",
               "email_normalised  (unique)", "phone_e164  (unique)",
               "last_followup_outcome", "owner_user_id · tombstoned_at"])

    box(ax, 9.5, 53, 17, "contact_roles", hue=S1, tfs=8.0,
        lines=["role", "active_from / to"])
    box(ax, 9.5, 35, 17, "contact_preferences", hue=S1, tfs=8.0,
        lines=["suburbs · price_min/max", "beds · baths · parking",
               "property_types · timeline", "finance_status",
               "soft_requirements", "embedding  (vector)"])
    box(ax, 9.5, 15, 17, "consents", hue=S4, tfs=8.0,
        lines=["channel · status", "source_form", "wording_shown",
               "ip_address · occurred_at"])

    box(ax, 57.5, 35, 17, "interactions", hue=S1, tfs=8.0,
        lines=["channel · direction", "occurred_at", "subject · body",
               "raw_s3_key · thread_ref", "append-only, never edited"])
    box(ax, 57.5, 55, 17, "contact_intent", hue=S7, tfs=8.0,
        lines=["intent_type · budget_band", "blockers · sentiment",
               "rolling_brief  (AI)"])
    box(ax, 57.5, 14, 17, "merge_reviews", hue=S4, tfs=8.0,
        lines=["similarity · status"])
    box(ax, 33.5, 13, 21, "confirm_items", hue=S4, tfs=8.0,
        lines=["proposed change (JSON)", "committed_by"])

    arrow(ax, (33.5, 53.3), (33.5, 44.1), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldx=2.6, ldy=0)
    arrow(ax, (18.2, 50.5), (25.5, 43.0), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldx=-2.4, ldy=1.6)
    arrow(ax, (18.2, 35), (21.3, 35), color=BASE, lw=1.1,
          label="1 → 1", lfs=6.4, ldy=1.7)
    arrow(ax, (18.2, 19.5), (23.5, 27.0), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldx=-2.6, ldy=0.6)
    arrow(ax, (45.7, 35), (48.8, 35), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldy=1.7)
    arrow(ax, (57.5, 43.1), (57.5, 49.4), color=BASE, lw=1.1,
          label="rebuilt from", lfs=6.4, ldx=6.0, ldy=0)
    arrow(ax, (44.0, 27.5), (51.0, 18.2), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldx=3.2, ldy=1.2)
    arrow(ax, (33.5, 25.9), (33.5, 17.7), color=BASE, lw=1.1,
          label="1 → n", lfs=6.4, ldx=2.6, ldy=0)

    caption(ax, 1.2, 4.0,
            "The contact is the hub — nothing here is deal-shaped, because one person "
            "accumulates roles over the years.\nInteractions are never edited: a "
            "correction is a new row, which is what makes the history defensible.")
    save(fig, "f4-erd-people.png")


# =============================================================== F5 ERD stock
def f5_erd_stock():
    fig, ax = canvas(6.6)

    box(ax, 33.5, 50, 25, "properties", hue=S3, tfs=9.2,
        lines=["address (structured) · suburb_id", "gnaf_pid · lat / lng  (reserved)",
               "beds · baths · parking", "land_area · floor_area · year_built",
               "features · condition", "owner_contact_id  → contacts",
               "internal_notes · price_expectation"])

    box(ax, 33.5, 25, 25, "listings", hue=S3, tfs=9.2,
        lines=["listing_type   sale | rent", "status   draft → live → sold",
               "price_display  (text, as written)",
               "search_price_min / max  (filters)", "public_headline · public_copy",
               "slug · published_at · sold_at"])

    box(ax, 8.5, 50, 14, "suburbs", hue=S3, tfs=8.0, lines=["SA seed data"])
    box(ax, 8.5, 25, 14, "listing_media", hue=S3, tfs=8.0,
        lines=["photo / floorplan", "sort_order · alt_text"])
    box(ax, 58.5, 25, 14, "inspections", hue=S3, tfs=8.0,
        lines=["open / private", "starts_at · capacity"])
    box(ax, 58.5, 50, 14, "ai_generations", hue=S7, tfs=8.0,
        lines=["model · tokens", "cost · latency"])

    box(ax, 20, 9.5, 20, "matches", hue=S7, tfs=8.4,
        lines=["score · reason (one line)"])
    box(ax, 48, 9.5, 20, "contacts", hue=S1, tfs=8.4, ls=(0, (3, 2)),
        lines=["the people side"])

    arrow(ax, (15.7, 50), (20.8, 50), color=BASE, lw=1.1, label="1 → n", lfs=6.4)
    arrow(ax, (33.5, 39.9), (33.5, 34.1), color=BASE, lw=1.1)
    caption(ax, 35.2, 37.0, "1 → n   (at most one live at a time)", color=MUTED, fs=6.4)
    arrow(ax, (20.8, 25), (15.7, 25), color=BASE, lw=1.1, label="1 → n", lfs=6.4)
    arrow(ax, (46.2, 25), (51.3, 25), color=BASE, lw=1.1, label="1 → n", lfs=6.4)
    arrow(ax, (46.2, 52), (51.3, 50), color=BASE, lw=1.1, ls=(0, (2, 2)))
    arrow(ax, (28.0, 16.1), (22.0, 13.1), color=BASE, lw=1.1, label="1 → n", lfs=6.4,
          ldx=-4.6, ldy=0.6)
    arrow(ax, (37.8, 9.5), (30.2, 9.5), color=BASE, lw=1.1, label="n → 1", lfs=6.4)
    arrow(ax, (44.0, 40.0), (50.0, 13.2), color=BASE, lw=1.1, ls=(0, (2, 2)), rad=-0.18,
          label="owner", lfs=6.4, lpos=0.86, ldx=2.4, ldy=0)

    caption(ax, 1.2, 3.2,
            "A property outlives its listings. Sold and leased listings are kept "
            "forever — they are the sold archive,\nthe content of the suburb pages, and "
            "the search equity the website earns over time.")
    save(fig, "f5-erd-stock.png")


# =========================================================== F6 matching funnel
def f6_matching():
    fig, ax = canvas(3.3)
    stages = [
        ("1 · Hard filters", "price · beds · suburb ·\navailability — plain SQL",
         "thousands → dozens", S3),
        ("2 · Vector similarity",
         "the soft wants a filter cannot\nexpress: “quiet street, no\nmain road”",
         "dozens → about 20", S1),
        ("3 · Claude ranks", "orders the shortlist and writes\none sentence per match",
         "ranked, and explained", S7),
    ]
    w = 19.5
    for i, (title, body, note, hue) in enumerate(stages):
        cx = 11.5 + i * 22
        box(ax, cx, 20, w, "", h=13.0, hue=hue)
        ax.text(cx, 24.6, title, ha="center", va="center", fontsize=8.3,
                fontweight="bold", color=INK, zorder=5)
        ax.text(cx, 20.0, body, ha="center", va="center", fontsize=7.1, color=INK2,
                zorder=5, linespacing=1.45)
        ax.text(cx, 15.4, note, ha="center", va="center", fontsize=6.8, color=INK,
                fontweight="bold", zorder=5)
        if i:
            arrow(ax, (cx - w / 2 - 2.5, 20), (cx - w / 2 - 0.7, 20))

    caption(ax, 1.2, 8.4,
            "Runs in both directions: property → the contacts who should hear about it, "
            "and contact → the properties that suit them.")
    caption(ax, 1.2, 4.6,
            "The one-sentence reason is not a nicety. An agent will not act on a bare "
            "score, and the reason is what gets the feature used\nrather than ignored.",
            color=INK2)
    save(fig, "f6-matching-engine.png")


# ============================================================ F7 site structure
def f7_site_structure():
    fig, ax = canvas(4.3)
    box(ax, 33.5, 38, 20, "Home", h=5.0, hue=S5, tfs=8.6)

    cols = [
        ("Buy", ["search + filters", "listing detail", "sold archive"], S5),
        ("Rent", ["search + filters", "listing detail", "leased archive"], S5),
        ("Suburbs", ["suburb profile", "live + sold stock", "market copy"], S5),
        ("Sell / Appraise", ["free appraisal", "sell my property", "proposal request"], S2),
        ("About / Blog", ["agent profile", "51 migrated posts", "contact"], S7),
    ]
    for i, (name, kids, hue) in enumerate(cols):
        cx = 7.5 + i * 13
        box(ax, cx, 27, 12, name, h=4.6, hue=hue, tfs=8.0)
        arrow(ax, (33.5, 35.3), (cx, 29.5), color=BASE, lw=1.0)
        y = 21.5
        for k in kids:
            ax.text(cx, y, k, ha="center", va="center", fontsize=6.8, color=INK2)
            y -= 2.6

    box(ax, 33.5, 8.5, 58,
        "Every form on every page → the contact list, with consent recorded", h=5.0,
        hue=S1, tfs=8.0)
    for i in range(5):
        cx = 7.5 + i * 13
        arrow(ax, (cx, 13.6), (cx, 11.2), color=S1, lw=1.1)

    caption(ax, 1.2, 3.0,
            "Search pages keep their filters in the URL, so a set of results can be "
            "linked, shared and indexed by Google.")
    save(fig, "f7-site-structure.png")


# ================================================================ F8 migration
def f8_migration():
    fig, ax = canvas(3.6)
    box(ax, 11, 27, 19, "TODAY  ·  Wix", hue=S2, tfs=8.6,
        lines=["22 service & info pages", "51 blog posts", "4 property pages",
               "Wix Bookings, in use"])
    box(ax, 56, 27, 19, "NEW  ·  Next.js on AWS", hue=S3, tfs=8.6,
        lines=["listings straight from the CRM", "search · suburbs · sold archive",
               "the same /post/ URLs", "every form → contact list"])
    diamond(ax, 33.5, 27, 17, 12, "301 redirect\nmap for every\nold URL", S4, fs=7.4)
    arrow(ax, (20.7, 27), (25.2, 27))
    arrow(ax, (41.9, 27), (46.4, 27))

    box(ax, 33.5, 9.5, 50, "", h=7.0, hue=S4)
    ax.text(33.5, 12.0, "Before the switch", ha="center", va="center", fontsize=7.9,
            fontweight="bold", color=INK, zorder=5)
    ax.text(33.5, 8.2,
            "Search Console verified · today's rankings captured · blog frozen · "
            "DNS time-to-live lowered\n"
            "Apex mail (MX) is never touched — the agency's existing email keeps working "
            "throughout",
            ha="center", va="center", fontsize=6.9, color=INK2, zorder=5,
            linespacing=1.5)
    caption(ax, 1.2, 2.6,
            "www.ozirealty.com.au stays the address. Changing the address during a "
            "migration risks the rankings the site already has.")
    save(fig, "f8-migration.png")


# ======================================================== F9 legacy inventory
def f9_legacy_inventory():
    fig = plt.figure(figsize=(W_IN, 2.5))
    ax = fig.add_axes([0.295, 0.215, 0.665, 0.715])
    items = [("Blog posts   /post/", 51, S1), ("Service & info pages", 22, S2),
             ("Property pages", 4, S3), ("Booking services", 1, S4)]
    labels = [i[0] for i in items][::-1]
    vals = [i[1] for i in items][::-1]
    colors = [i[2] for i in items][::-1]
    bars = ax.barh(labels, vals, height=0.58, color=colors, zorder=3)
    for b, v in zip(bars, vals):
        ax.text(b.get_width() + 0.9, b.get_y() + b.get_height() / 2, str(v),
                va="center", ha="left", fontsize=8.6, color=INK, fontweight="bold")
    ax.set_xlim(0, 60)
    ax.set_xlabel("URLs to migrate or redirect", fontsize=7.6, color=INK2)
    ax.tick_params(axis="y", labelsize=7.8, colors=INK, length=0)
    ax.tick_params(axis="x", labelsize=7.2, colors=MUTED, length=0)
    ax.grid(axis="x", color=HAIR, lw=0.7, zorder=0)
    ax.set_axisbelow(True)
    for s in ("top", "right", "bottom"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color(BASE)
    ax.spines["left"].set_linewidth(0.9)
    fig.text(0.295, 0.04,
             "Measured from the live sitemaps, 17 August 2026. The blog is still being "
             "published to, so re-count before the switch.",
             fontsize=6.5, color=MUTED, style="italic")
    save(fig, "f9-legacy-inventory.png")


# ========================================================== F10 compliance RAG
def f10_compliance():
    fig, ax = canvas(4.3)
    box(ax, 12, 37, 20, "The agent asks\na question", h=5.4, hue=S1, tfs=7.8)
    box(ax, 44, 37, 24, "Filter to the jurisdiction\nFIRST  —  South Australia",
        h=5.4, hue=S4, tfs=7.8)
    arrow(ax, (22.2, 37), (31.8, 37))

    box(ax, 18, 27, 24, "Exact wording\n“Form 1” · “cooling-off”", h=5.4, hue=S1,
        tfs=7.6)
    box(ax, 48, 27, 24, "Meaning\nparaphrase search", h=5.4, hue=S1, tfs=7.6)
    arrow(ax, (40, 34.2), (22, 29.8), rad=0.10)
    arrow(ax, (48, 34.2), (48, 29.8))

    box(ax, 33.5, 18, 26, "Results merged, then narrowed to about 8", h=5.0, hue=S7,
        tfs=7.8)
    arrow(ax, (20, 24.2), (28, 20.6))
    arrow(ax, (46, 24.2), (39, 20.6))

    box(ax, 18, 8.5, 24, "An answer, with the\nsection cited", h=5.4, hue=S7, tfs=7.8)
    box(ax, 48, 8.5, 24, "“Nothing relevant found”", h=5.4, hue=S8, tfs=7.8)
    arrow(ax, (28, 15.4), (20, 11.3), color=S7, label="found", ldx=-3.0, ldy=0.8,
          lfs=6.6, lcolor=S7)
    arrow(ax, (39, 15.4), (46, 11.3), color=S8, label="nothing\nrelevant", ldx=3.4,
          ldy=0.4, lfs=6.6, lcolor=S8)

    caption(ax, 1.2, 2.6,
            "It cites, or it stays silent. Every answer carries the jurisdiction, "
            "instrument and section, framed as research to verify\nwith a licensee or "
            "solicitor — never as a ruling.")
    save(fig, "f10-compliance-retrieval.png")


# ============================================================== F11 phase plan
def f11_phases():
    fig = plt.figure(figsize=(W_IN, 3.5))
    ax = fig.add_axes([0.245, 0.185, 0.70, 0.775])

    phases = [
        ("Phase 0   Foundations", 0, 1, S1),
        ("Phase 1   Contacts & intake", 1, 8, S1),
        ("Phase 2   Stock & matching", 9, 6, S3),
        ("Phase 2B  Public website", 15, 6, S5),
        ("Phase 3   Assistant & mobile", 21, 4, S2),
        ("Phase 4   Compliance & proposals", 25, 5, S7),
        ("Phase 5   Content & SEO", 30, 4, S6),
    ]
    ypos = list(range(len(phases)))[::-1]
    for (name, start, dur, hue), y in zip(phases, ypos):
        ax.barh(y, dur, left=start, height=0.56, color=hue, zorder=3)
        ax.text(start + dur + 0.6, y, f"{dur} wk" if dur == 1 else f"{dur} wks",
                va="center", ha="left", fontsize=7.0, color=INK)

    ax.axvline(15, color=CRIT, lw=1.2, ls=(0, (4, 2)), zorder=5)
    ax.text(14.6, len(phases) - 0.4, "independently sellable  ", fontsize=7.0,
            color=CRIT, fontweight="bold", va="center", ha="right")

    ax.set_yticks(ypos)
    ax.set_yticklabels([p[0] for p in phases], fontsize=7.6, color=INK)
    ax.set_xlim(0, 36)
    ax.set_xticks(range(0, 37, 4))
    ax.set_xlabel("indicative working weeks — one developer, phases run in sequence. "
                  "Not a committed schedule.", fontsize=7.0, color=INK2)
    ax.tick_params(axis="both", labelsize=7.0, colors=MUTED, length=0)
    ax.tick_params(axis="y", colors=INK)
    ax.grid(axis="x", color=HAIR, lw=0.7, zorder=0)
    ax.set_axisbelow(True)
    for s in ("top", "right", "bottom"):
        ax.spines[s].set_visible(False)
    ax.spines["left"].set_color(BASE)
    ax.spines["left"].set_linewidth(0.9)
    save(fig, "f11-phase-timeline.png")


# =========================================================== F12 infrastructure
def f12_infrastructure():
    fig, ax = canvas(4.6)
    ax.add_patch(FancyBboxPatch((2.0, 6.0), 63, 31.0,
                                boxstyle="round,pad=0,rounding_size=1.4",
                                linewidth=1.1, edgecolor=BASE,
                                facecolor=tint(S1, 0.975), zorder=1))
    ax.text(4.5, 8.6,
            "AWS  ·  ap-southeast-2 (Sydney)  —  all customer data stays inside this box",
            fontsize=7.6, color=INK2, fontweight="bold", va="center", zorder=2)

    box(ax, 15, 42, 24, "Visitors  &  the agent", h=4.8, hue=S5, tfs=8.2)
    box(ax, 15, 31, 21, "CloudFront + Route 53", h=5.0, hue=S1, tfs=7.8)
    box(ax, 15, 23, 21, "Caddy  ·  automatic TLS", h=5.0, hue=S1, tfs=7.8)
    box(ax, 15, 15, 21, "EC2:  web + worker", h=5.0, hue=S1, tfs=7.8)
    box(ax, 48, 31, 24, "RDS Postgres 16 + pgvector", h=5.0, hue=S3, tfs=7.8)
    box(ax, 48, 23, 24, "Redis  ·  the job queue", h=5.0, hue=S3, tfs=7.8)
    box(ax, 48, 15, 24, "S3: media, voice notes, PDFs", h=5.0, hue=S3, tfs=7.8)

    arrow(ax, (15, 39.5), (15, 33.6))
    arrow(ax, (15, 28.4), (15, 25.6))
    arrow(ax, (15, 20.4), (15, 17.6))
    for y in (31, 23, 15):
        arrow(ax, (25.7, 15.4), (35.8, y), color=BASE, lw=1.0, rad=-0.06)

    box(ax, 33.5, 2.6, 62,
        "Outside the region, and disclosed to customers:   Anthropic (Claude)  ·  "
        "Voyage (search)  ·  Deepgram (voice)  ·  MessageMedia (SMS)",
        h=3.8, hue=S7, tfs=7.0)
    save(fig, "f12-infrastructure.png")


if __name__ == "__main__":
    for fn in (f1_system_map, f2_pipeline, f3_approval, f4_erd_people, f5_erd_stock,
               f6_matching, f7_site_structure, f8_migration, f9_legacy_inventory,
               f10_compliance, f11_phases, f12_infrastructure):
        fn()
    print("\nall figures rendered to", OUT)
