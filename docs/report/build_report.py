"""
Builds docs/OziRealty-Platform-Specification.docx from the figures in ./figures.

Audience is the business owner, not a developer: plain language, every technical term
explained once, and every claim traceable to CLAUDE.md, docs/phases.md or
docs/legacy-site.md.

Run:  python figures.py && python build_report.py
"""

import os
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

HERE = os.path.dirname(os.path.abspath(__file__))
FIG = os.path.join(HERE, "figures")
OUT = os.path.abspath(os.path.join(HERE, "..", "OziRealty-Platform-Specification.docx"))

INK = RGBColor(0x0B, 0x0B, 0x0B)
INK2 = RGBColor(0x52, 0x51, 0x4E)
MUTED = RGBColor(0x89, 0x87, 0x81)
BLUE = RGBColor(0x1C, 0x5C, 0xAB)
BLUE_D = RGBColor(0x10, 0x42, 0x81)
CRIT = RGBColor(0xD0, 0x3B, 0x3B)

HEADER_FILL = "eaf1fb"
ZEBRA_FILL = "f7f7f5"
BODY_FONT = "Segoe UI"
FIGW = Cm(17.0)

doc = Document()
_fignum = [0]
_tabnum = [0]


# ----------------------------------------------------------------- page & styles
def setup():
    s = doc.sections[0]
    s.page_width, s.page_height = Cm(21), Cm(29.7)
    for attr, val in (("top_margin", 2.2), ("bottom_margin", 2.0),
                      ("left_margin", 2.0), ("right_margin", 2.0)):
        setattr(s, attr, Cm(val))

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = Pt(10)
    normal.font.color.rgb = INK
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.16

    for name, size, color, before, after in (
        ("Heading 1", 17, BLUE_D, 20, 8),
        ("Heading 2", 12.5, BLUE, 14, 5),
        ("Heading 3", 10.5, INK, 10, 3),
    ):
        st = doc.styles[name]
        st.font.name = BODY_FONT
        st.font.size = Pt(size)
        st.font.color.rgb = color
        st.font.bold = True
        st.font.italic = False
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True

    doc.core_properties.title = "OziRealty Platform — Specification & Build Plan"
    doc.core_properties.author = "OziRealty"
    doc.core_properties.comments = "Prepared for the owner. Version 1.0, 17 August 2026."


def footer_page_numbers():
    p = doc.sections[0].footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run("OziRealty Platform — Specification & Build Plan     ·     ")
    run.font.size = Pt(7.5)
    run.font.color.rgb = MUTED
    run.font.name = BODY_FONT
    for el, txt in (("begin", None), ("instr", "PAGE"), ("end", None)):
        r = OxmlElement("w:r")
        if el == "instr":
            it = OxmlElement("w:instrText")
            it.set(qn("xml:space"), "preserve")
            it.text = txt
            r.append(it)
        else:
            fc = OxmlElement("w:fldChar")
            fc.set(qn("w:fldCharType"), el)
            r.append(fc)
        p._p.append(r)
    for r in p.runs:
        r.font.size = Pt(7.5)
        r.font.color.rgb = MUTED
        r.font.name = BODY_FONT


# ------------------------------------------------------------------- primitives
def para(text, size=10, italic=False, bold=False, color=None, space_after=7,
         align=None, indent=None):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.italic = italic
    run.bold = bold
    run.font.color.rgb = color or INK
    p.paragraph_format.space_after = Pt(space_after)
    if align:
        p.alignment = align
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    return p


def rich(parts, size=10, space_after=7, indent=None):
    """parts = [(text, bold, italic), ...] — for a sentence with emphasis inside."""
    p = doc.add_paragraph()
    for text, bold, italic in parts:
        r = p.add_run(text)
        r.font.size = Pt(size)
        r.bold = bold
        r.italic = italic
        r.font.color.rgb = INK
    p.paragraph_format.space_after = Pt(space_after)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    return p


def bullets(items, numbered=False, size=10):
    for it in items:
        p = doc.add_paragraph(style="List Number" if numbered else "List Bullet")
        if isinstance(it, tuple):
            lead, rest = it
            r = p.add_run(lead)
            r.bold = True
            r.font.size = Pt(size)
            r.font.color.rgb = INK
            r2 = p.add_run(rest)
            r2.font.size = Pt(size)
            r2.font.color.rgb = INK
        else:
            r = p.add_run(it)
            r.font.size = Pt(size)
            r.font.color.rgb = INK
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.left_indent = Cm(0.7)


def h1(text, page_break=True):
    if page_break:
        doc.add_page_break()
    doc.add_heading(text, level=1)


def h2(text):
    doc.add_heading(text, level=2)


def h3(text):
    doc.add_heading(text, level=3)


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def table(headers, rows, widths=None, size=8.6, zebra=True, header_fill=HEADER_FILL):
    _tabnum[0] += 1
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False

    hdr = t.rows[0]
    trPr = hdr._tr.get_or_add_trPr()
    th = OxmlElement("w:tblHeader")
    trPr.append(th)
    for i, htext in enumerate(headers):
        c = hdr.cells[i]
        c.text = ""
        p = c.paragraphs[0]
        r = p.add_run(htext)
        r.bold = True
        r.font.size = Pt(size)
        r.font.color.rgb = BLUE_D
        r.font.name = BODY_FONT
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.space_before = Pt(2)
        shade(c, header_fill)

    for n, row in enumerate(rows):
        cells = t.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            p = cells[i].paragraphs[0]
            bold = val.startswith("**") and val.endswith("**")
            r = p.add_run(val.strip("*"))
            r.font.size = Pt(size)
            r.bold = bold
            r.font.color.rgb = INK
            r.font.name = BODY_FONT
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.space_before = Pt(2)
            if zebra and n % 2 == 1:
                shade(cells[i], ZEBRA_FILL)

    if widths:
        for row in t.rows:
            for i, wcm in enumerate(widths):
                row.cells[i].width = Cm(wcm)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return t


def figure(filename, caption_text, width=FIGW):
    _fignum[0] += 1
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(os.path.join(FIG, filename), width=width)

    c = doc.add_paragraph()
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = c.add_run(f"Figure {_fignum[0]}  ·  {caption_text}")
    r.font.size = Pt(8)
    r.italic = True
    r.font.color.rgb = INK2
    c.paragraph_format.space_after = Pt(12)


def callout(title, body, fill="fff6e0"):
    t = doc.add_table(rows=1, cols=1)
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = t.rows[0].cells[0]
    cell.width = Cm(16.0)
    shade(cell, fill)
    cell.text = ""
    p = cell.paragraphs[0]
    r = p.add_run(title + "   ")
    r.bold = True
    r.font.size = Pt(9.2)
    r.font.color.rgb = INK
    r2 = p.add_run(body)
    r2.font.size = Pt(9.2)
    r2.font.color.rgb = INK
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(4)
    doc.add_paragraph().paragraph_format.space_after = Pt(6)


# ============================================================== COVER + CONTENTS
def cover():
    for _ in range(4):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("OziRealty")
    r.font.size = Pt(40)
    r.bold = True
    r.font.color.rgb = BLUE_D
    r.font.name = BODY_FONT

    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("An AI-native CRM, operations platform\nand public website "
                  "for the agency")
    r.font.size = Pt(15)
    r.font.color.rgb = INK2
    r.font.name = BODY_FONT

    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Specification and build plan")
    r.font.size = Pt(12.5)
    r.bold = True
    r.font.color.rgb = INK

    for _ in range(9):
        doc.add_paragraph()

    for line, size, bold in (
        ("Prepared for the owner", 11, True),
        ("Version 1.0  ·  17 August 2026", 10, False),
        ("South Australia  ·  one office, one user at launch", 10, False),
    ):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(line)
        r.font.size = Pt(size)
        r.bold = bold
        r.font.color.rgb = INK if bold else INK2
        p.paragraph_format.space_after = Pt(3)

    for _ in range(2):
        doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("This document describes what will be built, in what order, what it "
                  "stores,\nand what is deliberately excluded. Nothing in it is final "
                  "until the decisions\nlisted in section 16 are made.")
    r.font.size = Pt(8.5)
    r.italic = True
    r.font.color.rgb = MUTED


def contents():
    doc.add_page_break()
    doc.add_heading("Contents", level=1)
    items = [
        ("1", "In one page", "the whole thing, briefly"),
        ("2", "What the platform is", "the parts and how they connect"),
        ("3", "How information gets in", "one pipeline, every channel"),
        ("4", "The rules that cannot be broken", "eight of them, and why"),
        ("5", "The contact record", "what we store about a person"),
        ("6", "Property and listing data", "the stock side"),
        ("7", "Matching people to property", "both directions"),
        ("8", "The public website", "buy, rent, search, suburbs"),
        ("9", "Moving off Wix", "22 pages, 51 posts, 4 listings"),
        ("10", "The compliance advisor", "cites, or stays silent"),
        ("11", "The remaining assistant surfaces", "proposals, content, SEO, voice"),
        ("12", "Build phases", "what arrives when"),
        ("13", "Technology and hosting", "and where the data lives"),
        ("14", "Deliberately out of scope", "and why"),
        ("15", "Decisions already made", "thirteen of them"),
        ("16", "What we still need from you", "the current blockers"),
        ("17", "Risks, and how they are managed", ""),
        ("A", "Appendix — every table and field", ""),
        ("B", "Appendix — the existing website, URL by URL", ""),
    ]
    for num, title, sub in items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.left_indent = Cm(0.4)
        r = p.add_run(f"{num}.   ")
        r.bold = True
        r.font.size = Pt(10)
        r.font.color.rgb = BLUE
        r = p.add_run(title)
        r.font.size = Pt(10)
        r.bold = True
        r.font.color.rgb = INK
        if sub:
            r = p.add_run(f"   —   {sub}")
            r.font.size = Pt(9.5)
            r.italic = True
            r.font.color.rgb = MUTED


# ==================================================================== SECTION 1
def s1_summary():
    h1("1.  In one page")

    para("This platform has one organising idea: the agency's value sits in its "
         "contact list — who each person is, what they want, and what happened at the "
         "last follow-up. Everything else exists to keep that list accurate and to act "
         "on it.")

    para("Enquiries arrive through many doors: the website, email, SMS replies, social "
         "messages, a phone call typed up afterwards, a voice note recorded in the car. "
         "Today each of those lives somewhere different. Here they all end up on one "
         "person's record, deduplicated, with a short AI-written brief that says where "
         "the relationship stands.")

    para("A second database holds the stock the agency controls — properties, and the "
         "sale or rental campaigns run over them. Because both sides sit in one system, "
         "the platform can answer the two questions that actually make money: which "
         "property suits this person, and who should hear about this listing. It answers "
         "them with a ranked shortlist and a one-sentence reason for each name.")

    para("On top of that sit the assistant surfaces: a compliance advisor that answers "
         "South Australian legislation questions with the section cited, a proposal "
         "generator, a content and social engine, and a technical SEO agent. And in "
         "front of the whole thing, a new public website replacing the current Wix "
         "site — buy and rent search, listing pages, a sold archive, suburb pages, and "
         "enquiry forms that feed straight into the contact list.")

    h2("The three things worth knowing before reading further")

    rich([("Nothing is sent without a human pressing approve. ", True, False),
          ("Every AI-drafted email, SMS, social post and article goes into an approval "
           "queue. There is no automatic send path anywhere in the design, and no "
           "setting that creates one. This is a legal position as much as a product "
           "one — under the Spam Act the agency has to be able to defend every message "
           "it sends.", False, False)])

    rich([("Phase 1 and Phase 2 are the product, not a milestone. ", True, False),
          ("The contact list, the intake pipeline, the property database, matching and "
           "the approval queue together make something the agency can run its day on. "
           "Everything after that adds leverage, not viability.", False, False)])

    rich([("The website is a migration, not a launch. ", True, False),
          ("ozirealty.com.au already carries 22 pages, 51 blog posts and four property "
           "pages on Wix, and it has search rankings that took time to earn. The plan "
           "protects those deliberately: same address, same blog URLs, a redirect for "
           "every old page, and the agency's existing email untouched throughout.",
           False, False)])

    callout("Cost note.",
            "Every AI call is logged with its model, token counts and cost, attributed "
            "to the record it relates to. The running spend is visible on screen from "
            "the end of Phase 2 — not estimated later.")


# ==================================================================== SECTION 2
def s2_what():
    h1("2.  What the platform is")

    para("Six parts, one database. The contact list sits at the centre; every channel "
         "terminates in it and every assistant surface reads from it.")

    figure("f1-system-map.png",
           "The whole platform. Inbound channels on the left, the contact list and the "
           "stock database in the middle, the assistant surfaces on the right, and the "
           "public website in front.")

    h2("The parts, in plain terms")

    table(["Part", "What it does", "Arrives in"],
          [["**The contact list**",
            "One record per person, accumulating roles over time — a tenant this year "
            "may be a buyer in three years and a vendor in ten. Holds what they want "
            "and the outcome of the last follow-up as real fields, not notes.",
            "Phase 1"],
           ["**The interaction log**",
            "Every touch on every channel, in order, never edited. This is the only "
            "thing the AI reads when it writes a brief, which is why it has to be "
            "complete.", "Phase 1"],
           ["**The property & listing database**",
            "The stock the agency controls, independent of whether it is currently "
            "advertised. A property keeps its whole history: sold in 2019, leased in "
            "2022, for sale again now.", "Phase 2"],
           ["**The matching engine**",
            "Property → the contacts who should hear about it, and contact → the "
            "properties that suit them. Ranked, with a reason per name.", "Phase 2"],
           ["**The approval queue**",
            "The single door every outbound message leaves through. Draft, edit, "
            "approve or reject, with an audit trail.", "Phase 2"],
           ["**The public website**",
            "Buy and rent search, listing pages, sold archive, suburb pages, appraisal "
            "and enquiry forms. Reads the same listings the CRM writes, so there is no "
            "second system to keep in step.", "Phase 2B"],
           ["**The assistant surfaces**",
            "Compliance advisor, proposal generator, content and social engine, "
            "technical SEO agent, voice-to-task.", "Phases 3–5"]],
          widths=[3.6, 10.2, 2.2])


# ==================================================================== SECTION 3
def s3_intake():
    h1("3.  How information gets in")

    para("Every channel runs through the same short pipeline. That is a deliberate "
         "constraint: adding a channel later — a new portal, a new social network, a "
         "new form — means writing one small adapter and registering it. The pipeline "
         "itself is never modified. If it ever needs modifying to fit a new channel, "
         "that is a signal the design is wrong and gets fixed at the interface rather "
         "than patched.")

    figure("f2-ingest-pipeline.png",
           "The intake pipeline. Everything from a website form to a voice note follows "
           "this path.")

    h2("What happens at each step")

    bullets([
        ("Adapter and normalise — ", "the channel's own format is turned into one "
         "common shape. An email, a form post and a typed-up phone call all come out "
         "the same on the other side."),
        ("Identity resolve — ", "we match on normalised email and full international "
         "phone number. If the match is ambiguous, it goes to a review queue. We never "
         "merge two people automatically because their names look similar; that is how "
         "contact databases quietly corrupt."),
        ("Interaction row — ", "the touch is written to the log. This is append-only: "
         "nothing is ever edited or deleted, and a correction is a new row. For an "
         "email we also keep the original message in storage, so there is evidence "
         "behind the record and not just our summary of it."),
        ("AI summarise, then rolling brief — ", "a cheap fast model extracts the "
         "substance; a stronger model maintains a one-paragraph brief on where the "
         "relationship stands. The brief is rebuilt from the log each time, never "
         "hand-edited — so it cannot drift away from what actually happened."),
        ("Confirm queue — ", "if the AI thinks it has found a task (\"call back "
         "Tuesday\") or a changed requirement (\"now looking up to $850k\"), it "
         "proposes the change. The agent commits it. The AI never writes to the "
         "contact record on its own."),
    ])

    callout("Why the confirm queue matters.",
            "An assistant that silently edits your database is one you stop trusting "
            "the moment it gets something wrong — and then you stop using it. Proposing "
            "instead of writing keeps the record trustworthy and keeps the tool in use.")


# ==================================================================== SECTION 4
def s4_rules():
    h1("4.  The rules that cannot be broken")

    para("These eight are product and legal requirements rather than preferences. They "
         "are written into the project's own instructions so they are not quietly "
         "traded away under deadline pressure.")

    table(["#", "The rule", "Why it exists"],
          [["1", "**Human approval before any outbound message.** Every AI-drafted "
                 "email, SMS, social post or article enters the approval queue.",
            "The agency's name is on every message. There is no version of an "
            "automatic send that is worth the reputational risk."],
           ["2", "**Consent is checked at the moment of sending**, not when the draft "
                 "was written.",
            "Someone who unsubscribes between Tuesday's draft and Thursday's send must "
            "not receive it. Spam Act exposure sits exactly here."],
           ["3", "**The compliance advisor cites, or says nothing.** Jurisdiction, "
                 "instrument and section on every answer.",
            "An unsourced legal answer is worse than no answer, because it gets acted "
            "on. It is framed as research to verify, never as a ruling."],
           ["4", "**The SEO agent proposes, never deploys.** It produces a change set "
                 "a human approves.",
            "Nothing automated should be able to alter a live website."],
           ["5", "**AI never silently writes to a contact record.** Extracted tasks and "
                 "changed preferences go to a confirm queue.",
            "The contact list is the asset. It stays under human control."],
           ["6", "**Data stays in Sydney (ap-southeast-2).** The only exceptions are "
                 "the AI, voice and SMS vendors, disclosed to customers.",
            "Privacy Act obligations, and a genuine sales argument with Australian "
            "vendors."],
           ["7", "**Every AI call is logged** with model, tokens, cost, latency and "
                 "the record it relates to.",
            "So the running cost is a number on a screen, not a surprise on a card "
            "statement."],
           ["8", "**The public website reads through its own restricted layer.**",
            "Property records contain the owner's contact details and internal price "
            "expectations. One careless query on a public page would publish them."]],
          widths=[0.8, 7.4, 7.8])

    figure("f3-approval-gate.png",
           "Rules 1 and 2 in practice. The consent check is deliberately the last thing "
           "that happens before a message leaves.")


# ==================================================================== SECTION 5
def s5_contacts():
    h1("5.  The contact record")

    para("The record is built around a person, never around a deal. That sounds like a "
         "technical distinction; it is actually the difference between a database that "
         "gets more valuable every year and one that has to be rebuilt when the market "
         "turns. A person who rented through the agency in 2021 and buys in 2027 is one "
         "record with two roles, not two unrelated files.")

    figure("f4-erd-people.png",
           "The people side of the database. Boxes are tables; lines show how they "
           "relate. “1 → n” means one row on the left connects to many on the right.")

    h2("The tables, and why each one is separate")

    table(["Table", "What it holds", "Why it is its own table"],
          [["**contacts**",
            "Name, email, phone, who owns the relationship, and the outcome of the last "
            "follow-up.",
            "The hub. `last_followup_outcome` is a real field rather than a note, "
            "because it is the thing you sort and filter a day's work by."],
           ["**contact_roles**",
            "Buyer, vendor, landlord, tenant, referrer, investor — with dates.",
            "So one person can hold several roles across the years without duplicate "
            "records."],
           ["**contact_preferences**",
            "Suburbs, price band, beds, baths, parking, timeline, finance status, and "
            "free-text “soft requirements”.",
            "The soft requirements field (“quiet street, no main road”) is what the "
            "matching engine uses to catch things a filter cannot express."],
           ["**interactions**",
            "Every touch, every channel, in order, with the original message kept.",
            "Append-only and never edited, so the history is evidence. Deleting is "
            "impossible by design; a privacy request marks a row rather than erasing "
            "the trail."],
           ["**contact_intent**",
            "What the AI currently believes: intent, budget band, blockers, sentiment, "
            "and a one-paragraph brief.",
            "Kept separate because it is derived. It is rebuilt from the log, so a bad "
            "brief is fixed by correcting the underlying interaction — not by editing "
            "the summary."],
           ["**consents**",
            "One row per person per channel per grant, recording the form, the exact "
            "wording shown, the time and the IP address.",
            "Without provenance a send cannot be defended. This can only be captured "
            "at the moment someone submits a form — it cannot be reconstructed later."],
           ["**merge_reviews**",
            "Two records that might be the same person, with a similarity score.",
            "A human decides. Automatic merging on name similarity is how you lose "
            "data you cannot get back."]],
          widths=[3.0, 6.4, 6.6])

    h2("What we deliberately do not store")

    bullets([
        "No free-text field is treated as the system of record for something structured. "
        "If it matters — a price band, a timeline, a follow-up outcome — it gets a "
        "column, so it can be searched and reported on.",
        "No vendor motivation, internal price expectation or private note anywhere that "
        "the public website can read. That separation is enforced in code and tested "
        "(see rule 8).",
    ])


# ==================================================================== SECTION 6
def s6_stock():
    h1("6.  Property and listing data")

    para("A property and a listing are two different things, and keeping them apart is "
         "what lets the platform hold a full history. The property is the physical "
         "asset — it exists whether or not it is currently advertised. A listing is one "
         "campaign over that property: for sale in 2019, for rent in 2022, for sale "
         "again now. At most one listing is live at a time; the rest are kept.")

    figure("f5-erd-stock.png",
           "The stock side. The dashed box is the contact record from Figure 4 — the "
           "two halves of the system meet at the owner of a property and at a match.")

    h2("Two decisions inside this that matter commercially")

    rich([("The advertised price is text the agent writes, not a number the system "
           "formats. ", True, False),
          ("“Offers above $750,000”, “Contact agent”, “$650,000 – $690,000” — the "
           "wording is stored and displayed exactly as authored. Separate hidden "
           "minimum and maximum numbers drive the search filters only. Under-quoting "
           "provisions make displayed price wording a legal artefact, so the agent "
           "controls it and the software renders it verbatim.", False, False)])

    rich([("Sold and leased listings are kept forever. ", True, False),
          ("They are the sold archive, the substance of the suburb pages, and the part "
           "of the website that earns search traffic over time. Deleting old listings "
           "throws away the site's best long-term asset.", False, False)])

    para("Rental listings are advertised, not managed. The platform will market a "
         "rental and capture the enquiries; it does not run leases, rent ledgers, "
         "routine inspections or trust accounting. See section 14.")


# ==================================================================== SECTION 7
def s7_matching():
    h1("7.  Matching people to property")

    para("This is the feature that pays for the rest of the system. It runs in both "
         "directions and in three stages, cheapest first — so the expensive AI step "
         "only ever looks at a shortlist.")

    figure("f6-matching-engine.png",
           "Three stages. Filters do the bulk cheaply; similarity catches what filters "
           "cannot express; the AI ranks and explains what is left.")

    para("The third stage produces a one-sentence reason for every name: “three-bedroom "
         "in Norwood, and they asked specifically about quiet streets away from Magill "
         "Road.” That sentence is not decoration. An agent will not pick up the phone "
         "on the strength of a similarity score, and experience with these systems is "
         "that the explanation is the difference between a feature that gets used daily "
         "and one that gets ignored after a week.")


# ==================================================================== SECTION 8
def s8_website():
    h1("8.  The public website")

    para("The new site is built inside the same application as the CRM, sharing one "
         "database. When the agent marks a listing live, it is live on the site "
         "seconds later — there is no export, no sync, and nothing to get out of step.")

    figure("f7-site-structure.png",
           "The site's structure. Every form on every page lands in the contact list "
           "with its consent record attached.")

    h2("What the site does")

    table(["Area", "Detail"],
          [["**Buy and rent search**",
            "Suburb, price range, beds, baths, parking, property type, land size, "
            "keyword. Sort by price or newest. The filters live in the web address, so "
            "a set of results can be bookmarked, texted to a client, and indexed by "
            "Google."],
           ["**Listing pages**",
            "Photo gallery, floorplan, features, the agent-authored description, "
            "inspection times with registration, enquiry form, and similar listings "
            "generated by the matching engine."],
           ["**Sold and leased archive**",
            "Filterable and per-suburb, showing the result where the agent has chosen "
            "to display it."],
           ["**Suburb pages**",
            "One per suburb the agency works, built from live listings, sold history "
            "and the agent's own market commentary. This is the page type that earns "
            "organic search traffic."],
           ["**Lead forms**",
            "Listing enquiry, book an inspection, general contact, and “what's my home "
            "worth” — which on most agency sites is the single highest-value form on "
            "the site and gets its own landing page."],
           ["**Blog**",
            "The 51 existing posts, migrated and kept at their current web addresses."]],
          widths=[3.4, 12.6])

    h2("Two things it will not do at launch")

    bullets([
        ("Map view. ", "Showing listings on a map needs coordinates for every address, "
         "which needs an address service we have not yet connected. The database "
         "columns and the background job are built and left dormant, so switching it on "
         "later is a credentials change and a one-off backfill — not a rebuild. Search "
         "is list-based until then."),
        ("Property alerts. ", "“Email me new listings matching this search” is a normal "
         "website feature and it is also an automatic send, which rule 1 forbids. It "
         "can be built as a nightly digest that the agent approves as a batch, with "
         "consent re-checked at send. If approving a daily digest is impractical, the "
         "honest answer is not to offer alerts rather than to make an exception."),
    ])


# ==================================================================== SECTION 9
def s9_migration():
    h1("9.  Moving off Wix")

    para("ozirealty.com.au is a live Wix site with real search equity. We measured what "
         "is on it from the site's own sitemaps on 17 August 2026, rather than "
         "estimating: 22 service and information pages, 51 blog posts, four property "
         "pages, and Wix Bookings taking appointments. The most recent blog post was "
         "published that same day, so the site is actively in use.")

    figure("f9-legacy-inventory.png",
           "What has to be carried across. Every one of these URLs needs a destination "
           "decided before the switch, not after.")

    figure("f8-migration.png",
           "The migration. The redirect map is the whole job — everything else is "
           "ordinary building.")

    h2("How the rankings are protected")

    bullets([
        ("The address does not change. ", "The site stays on www.ozirealty.com.au. "
         "Changing the canonical address during a migration doubles the risk for no "
         "benefit."),
        ("Blog URLs are preserved exactly. ", "All 51 posts keep their current /post/ "
         "addresses. A tidier URL scheme is not worth 51 redirects."),
        ("Every old page gets a destination. ", "One-to-one where an equivalent exists; "
         "otherwise the nearest parent page. Never the home page, and never a “page not "
         "found”."),
        ("Two spelling mistakes in the current addresses are fixed and redirected. ",
         "The existing site has /oversees-investment and "
         "/contact-adelaide-realestae-agency. The new site spells both correctly and "
         "redirects from the old spellings, which are never dropped."),
        ("Measured before, measured after. ", "Search Console is verified and today's "
         "rankings captured before the switch, so any drop afterwards is a fact rather "
         "than an argument."),
        ("The agency's email is never touched. ", "Inbound platform mail runs on a "
         "separate subdomain. The main domain's mail settings are left exactly as they "
         "are, throughout."),
    ])

    callout("One live thing needs a decision.",
            "/book-online currently takes real appointments through Wix Bookings. The "
            "plan does not replace it before the switch — the calendar arrives in Phase "
            "3. Either the website gains a booking form in Phase 2B, or that one page "
            "keeps pointing at Wix for a while. Left undecided, a working source of "
            "appointments disappears on cutover day.")


# =================================================================== SECTION 10
def s10_compliance():
    h1("10.  The compliance advisor")

    para("A research tool for South Australian agency legislation, vendor disclosure "
         "and consumer law. It is the most carefully constrained part of the platform, "
         "because a confident wrong answer about a Form 1 obligation is worse than no "
         "tool at all.")

    figure("f10-compliance-retrieval.png",
           "How an answer is produced. Filtering to the jurisdiction happens before "
           "anything is searched, so another state's rules cannot surface.")

    bullets([
        ("Two searches, not one. ", "Legislation questions need exact terms (“Form 1”, "
         "“cooling-off”, “section 7”) and paraphrase at the same time. The results are "
         "merged and narrowed before any answer is written."),
        ("Every answer carries its source. ", "Jurisdiction, instrument, section. If "
         "the search finds nothing relevant, the tool says so instead of "
         "improvising."),
        ("Framed as research, always. ", "Output is explicitly something to verify with "
         "a licensee or solicitor. It never renders a ruling."),
        ("Legislation changes, so we re-check monthly. ", "Every instrument carries the "
         "date of the version we hold, and an amendment to something previously cited "
         "raises an alert. Silent amendments are the main way a tool like this becomes "
         "wrong."),
    ])

    callout("This phase cannot start until you decide the sources.",
            "Which registers and instruments to ingest, and the licence for each, is a "
            "business and legal decision rather than a technical one. Most Australian "
            "registers are openly licensed, but that has to be confirmed per source "
            "before anything is copied.")


# =================================================================== SECTION 11
def s11_rest():
    h1("11.  The remaining assistant surfaces")

    table(["Surface", "What it does", "Phase"],
          [["**Voice-to-task**",
            "Record a note in the car; it is transcribed, the tasks are extracted, and "
            "they wait in the confirm queue. The interaction is on the contact record "
            "either way.", "3"],
           ["**Tasks, calendar, alarms**",
            "The daily working layer, with two-way sync to the agent's Google or "
            "Outlook calendar. The external calendar stays the source of truth for "
            "anything it owns — the platform never edits or deletes an appointment it "
            "did not create.", "3"],
           ["**Digital business card**",
            "A public profile page with a QR code and a contact-card download, and an "
            "enquiry form that feeds the same contact list.", "3"],
           ["**Mobile**",
            "The website and CRM work as an installable app on a phone, including "
            "reading contacts with no signal and queueing what was written offline. "
            "There is no app-store build — the web app is the mobile strategy.", "3"],
           ["**Proposal generator**",
            "Agency data, the property and comparable sales into a formatted PDF "
            "proposal. It is outbound, so it goes through the approval queue.", "4"],
           ["**Content and social engine**",
            "Drafts blog posts and social content in the agency's voice. Everything is "
            "approved before it publishes.", "5"],
           ["**Technical SEO agent**",
            "Crawls the site fortnightly and produces a reviewable list of proposed "
            "changes. It has no ability to publish — not even a disabled one.", "5"]],
          widths=[3.4, 11.0, 1.6])


# =================================================================== SECTION 12
def s12_phases():
    h1("12.  Build phases")

    para("Each phase has to be working and demonstrable before the next one starts. "
         "That is a deliberate constraint on the build: it prevents four half-finished "
         "subsystems and produces something usable early.")

    figure("f11-phase-timeline.png",
           "Sequence and relative size. The week figures are indicative — one developer "
           "working through the phases in order — and are not a committed schedule.")

    callout("How to read the timeline.",
            "The durations come from the size of each phase's work list, not from a "
            "quote. They assume one developer, no parallel work, and no waiting on "
            "decisions or access. Treat them as relative weight; a committed schedule "
            "needs the open items in section 16 closed first.")

    table(["Phase", "What you get at the end of it", "Items"],
          [["**0 · Foundations**",
            "Project set up, database running, and a script that could rebuild the "
            "server from scratch. Nothing visible; everything after it depends on it.",
            "4"],
           ["**1 · Contacts & intake**",
            "The working CRM: contacts, the interaction log, website and email intake, "
            "AI briefs, the confirm and merge queues, and a dashboard. Deployed and "
            "backed up, with the restore actually tested.", "15"],
           ["**2 · Stock & matching**",
            "Properties, photos, the matching engine both ways, opportunity campaigns, "
            "SMS, the approval queue, and the AI cost dashboard. "
            "**With Phase 1, this is an independently sellable product.**", "11"],
           ["**2B · Public website**",
            "The new site live on www.ozirealty.com.au, migrated off Wix with every "
            "redirect verified, and every form feeding the contact list.", "14"],
           ["**3 · Assistant & mobile**",
            "Voice-to-task, tasks, calendar sync, digital business card, and offline "
            "mobile use.", "8"],
           ["**4 · Compliance & proposals**",
            "The SA compliance advisor with citations, and the proposal generator.",
            "9"],
           ["**5 · Content & SEO**",
            "Blog authoring, social publishing, the SEO agent's proposed change sets, "
            "and reporting.", "7"]],
          widths=[3.2, 11.2, 1.6])

    para("The detailed item-by-item plan — 68 numbered pieces of work, each one session, "
         "with the demonstration that closes each phase — is maintained alongside the "
         "code in docs/phases.md and stays current as work proceeds.",
         size=9, italic=True, color=INK2)


# =================================================================== SECTION 13
def s13_tech():
    h1("13.  Technology and hosting")

    para("Everything runs on Amazon Web Services in the Sydney region. Australian data "
         "residency is both a Privacy Act obligation and a straightforward sales "
         "argument when a vendor asks where their correspondence goes.")

    figure("f12-infrastructure.png",
           "The hosting shape. Everything inside the outlined box is in Sydney; the "
           "four vendors below it are the only processing that happens elsewhere, and "
           "they are disclosed to customers.")

    table(["Layer", "Choice", "Why"],
          [["Application", "Next.js 15 with TypeScript",
            "One application serving both the public website and the CRM, so listings "
            "never need syncing between two systems."],
           ["Database", "PostgreSQL 16 with pgvector",
            "One database for both ordinary records and the similarity search the "
            "matching engine needs. No second search system to run."],
           ["Background work", "Redis job queue",
            "Transcription, AI summaries and campaign matching happen out of band, so a "
            "slow AI call never makes a page hang."],
           ["AI", "Anthropic Claude — a fast model and a strong one",
            "Cheap fast model for extraction and ranking, stronger model for briefs, "
            "drafts and compliance answers. Chosen per task to control cost."],
           ["Voice", "Deepgram", "Handles Australian accents well."],
           ["SMS", "MessageMedia", "Australian sender IDs and local deliverability."],
           ["Email in", "AWS SES on a subdomain",
            "No mailbox passwords to store, arrives in seconds, and the original "
            "message is kept as evidence. The agency's existing email is untouched."],
           ["Server", "One EC2 instance, two services",
            "Deliberately simple. A script in the repository can rebuild the machine "
            "from nothing, which is what keeps the setup honest."]],
          widths=[2.8, 4.6, 8.6])

    h2("What is in place regardless of scale")

    bullets([
        "Nightly database backup to storage, with a restore actually performed and "
        "verified — an untested backup is not a backup.",
        "Error tracking and uptime monitoring from the first deployment.",
        "Administrative access over a private network with the public SSH port closed.",
        "Automatic HTTPS certificates.",
    ])


# =================================================================== SECTION 14
def s14_scope():
    h1("14.  Deliberately out of scope")

    para("These are excluded on purpose. Each one is a defensible decision rather than "
         "an omission, and each can be revisited as a separate piece of work.")

    table(["Not building", "Why"],
          [["**Trust accounting**",
            "Regulated and audited, and a different product entirely. Getting it wrong "
            "has consequences no CRM feature justifies."],
           ["**Property management (leases, ledgers, routine inspections)**",
            "Rentals are advertised, not administered. Worth noting: the current "
            "website markets property management on four pages, so the service is sold "
            "while being run outside this system. That is workable, but it should be a "
            "conscious choice."],
           ["**Portal feeds to realestate.com.au and Domain**",
            "Certification takes months. Deferred beyond Phase 5 rather than "
            "abandoned."],
           ["**A mobile app store build**",
            "The installable web app covers phones, including offline use, without two "
            "app store review processes."],
           ["**Any automatic send, publish or deploy**",
            "Rules 1 and 4. Not a limitation to be lifted later — a design position."],
           ["**Bulk import of existing data**",
            "Not needed now. Worth flagging that deduplicating forty enquiries a week "
            "is a different problem from deduplicating an eight-thousand-row import, so "
            "if an import is wanted later it is real work rather than a menu option."],
           ["**Business brokerage and buyer's-agency matching**",
            "The current website sells both. Contacts can carry those roles from Phase "
            "1, but the matching engine understands residential property preferences "
            "and has nothing useful to say about the sale of a business."]],
          widths=[5.4, 10.6])


# =================================================================== SECTION 15
def s15_decisions():
    h1("15.  Decisions already made")

    para("Recorded so they are not silently reopened later. Each is written into the "
         "project's own instructions.")

    table(["#", "Decision", "Consequence"],
          [["D1", "**One office, one user.** No franchise hierarchy, no multi-user.",
            "Simpler build. Two safeguards ship anyway — every table carries an agency "
            "column and every query passes through one controlled layer — because "
            "adding those later would mean rewriting everything."],
           ["D2", "**South Australia only.**",
            "The jurisdiction machinery exists and is loaded with SA alone. Adding NSW "
            "later is a data load, not a rewrite — provided nothing hardcodes “SA”, "
            "which is enforced."],
           ["D3", "**Inbound email through AWS SES** on a dedicated subdomain.",
            "No mailbox credentials stored, seconds-fast, original message retained. "
            "Does not read the agent's own inbox — see the note below."],
           ["D4", "**Address matching (G-NAF) deferred.**",
            "Structured address fields now, with the identifier column reserved for a "
            "later backfill."],
           ["D5", "**Two-way calendar sync.**",
            "Google and Outlook, with the external calendar as the source of truth for "
            "anything it owns."],
           ["D6", "**Legal corpus sources deferred.**", "Blocks all of Phase 4."],
           ["D7", "**Social networks not yet chosen.**",
            "Blocks the social publishing item in Phase 5 only."],
           ["D8", "**No data import for now.**",
            "Identity matching is designed for enquiry-rate volume."],
           ["D9", "**Public website in scope**, as Phase 2B.",
            "Same application, separate restricted read layer."],
           ["D10", "**Rentals advertised, not managed.**", "See section 14."],
           ["D11", "**No map provider yet**; access to come.",
            "Columns and the background job are built and dormant."],
           ["D12", "**The existing Wix site is migrated, not abandoned.**",
            "www stays the address; 51 blog URLs preserved; apex mail untouched."],
           ["D13", "**Brand assets exist** and will be supplied.",
            "The public site's design waits on them; the CRM does not."]],
          widths=[1.0, 6.6, 8.4])

    callout("The one open question inside D3.",
            "SES receiving sees mail addressed to the platform — portal enquiries, "
            "replies to our own campaigns, anything deliberately forwarded. It does not "
            "see a conversation happening directly between the agent and a client in "
            "Outlook. If that visibility turns out to matter, the mailbox permission can "
            "be added onto the calendar connection that Phase 3 already requires — which "
            "is why the decision was split in two rather than committed now.")


# =================================================================== SECTION 16
def s16_needs():
    h1("16.  What we still need from you")

    para("Listed in the order they block work. Nothing here stops the foundations "
         "starting.")

    table(["What", "Needed by", "Why it blocks"],
          [["**Brand assets** — logo in vector form, colour values with their roles, "
            "font files and their licence, photography and its usage rights.",
            "Phase 2B",
            "The CRM can ship on sensible defaults. A public website cannot. Font "
            "licences in particular: a desktop-only licence cannot legally be used on "
            "a website."],
           ["**AWS account access** — the account itself, Sydney region, and "
            "permissions for database, storage, email, DNS and content delivery. Also: "
            "does the domain's registration move, or only its DNS?",
            "End of Phase 1",
            "Nothing can be deployed or backed up without it."],
           ["**Confirmation that inbound email receiving is available in the Sydney "
            "region.** One lookup in the AWS console.",
            "Phase 1, item 1.13",
            "If Sydney is not supported, the choice is a non-Australian mail region — "
            "which contradicts the data residency commitment and is your decision — or "
            "a different mechanism."],
           ["**Wix access** — an administrator login, or an export of the 51 posts and "
            "4 property records with their images.",
            "Phase 2B",
            "The blog cannot be migrated without the content."],
           ["**A decision on /book-online.** Replace it with a booking form in Phase "
            "2B, or leave it pointing at Wix past the switch?",
            "Before cutover",
            "It takes real appointments today. Undecided means it silently stops "
            "working."],
           ["**The legal corpus list** — which instruments and registers, with a "
            "licence confirmed for each.",
            "Phase 4",
            "This is a legal and business decision, not a technical one."],
           ["**Social networks**, and which accounts the agency will actually connect.",
            "Phase 5", "One item only."],
           ["**Confirmation of the working name “OziRealty”.**",
            "Phase 0", "It is written into the server configuration and service names."]],
          widths=[6.6, 3.0, 6.4])


# =================================================================== SECTION 17
def s17_risks():
    h1("17.  Risks, and how they are managed")

    table(["Risk", "How it is handled"],
          [["**Search rankings drop after the website switch.** The most likely way "
            "this project causes measurable commercial damage.",
            "A destination decided for every existing URL before launch; the address "
            "and all 51 blog URLs unchanged; Search Console verified and current "
            "rankings captured beforehand so the effect is measurable; every redirect "
            "crawled and verified after; rankings watched for a fortnight."],
           ["**The agency's email breaks during the migration.**",
            "Platform mail runs on a separate subdomain and the main domain's mail "
            "settings are never modified. This is stated as a constraint in the "
            "project instructions, not left to memory."],
           ["**Blog posts written during the migration are lost.**",
            "A short content freeze, migrate, verify, then switch. The blog is actively "
            "published to, so this is a real scheduling matter rather than a "
            "theoretical one."],
           ["**AI writes something wrong into the contact record.**",
            "It cannot. Extracted tasks and changed preferences are proposals a human "
            "commits, and the AI's rolling brief is rebuilt from the interaction log "
            "rather than edited in place."],
           ["**An AI-drafted message goes to someone who unsubscribed.**",
            "Consent is re-checked at the instant of sending and the send is blocked "
            "and logged if it has lapsed."],
           ["**A vendor's private details appear on the public website.**",
            "Public pages cannot query the database directly. They read through a "
            "restricted layer that names every field it will return, and automated "
            "tests assert that owner details and internal price expectations cannot "
            "come back through it."],
           ["**AI costs run away unnoticed.**",
            "Every call is logged with its cost and shown on a dashboard from the end "
            "of Phase 2. Cheap models are used for the high-volume work, and "
            "non-urgent work is batched at roughly half price."],
           ["**The compliance advisor becomes wrong as legislation changes.**",
            "Every instrument stores the date of the version held; sources are "
            "re-checked monthly and an amendment to something previously cited raises "
            "an alert."],
           ["**The single server fails.**",
            "Nightly backups to storage with a tested restore, error and uptime "
            "monitoring, and a provisioning script that can rebuild the machine from "
            "nothing. At one office's scale this is the proportionate answer; it is "
            "revisited if the load changes."],
           ["**Estimates in section 12 turn out to be optimistic.**",
            "They are presented as relative weight rather than a schedule, and each "
            "phase must be demonstrable before the next begins — so slippage is "
            "visible early and in public rather than at the end."]],
          widths=[6.0, 10.0])


# ================================================================== APPENDIX A
FIELD_REF = [
    ("People and consent", [
        ("tenants", [
            ("id", "Internal identifier."),
            ("name / trading_name", "The agency as it appears internally and publicly."),
            ("abn · licence_number", "Held for proposals and compliance disclosure."),
            ("jurisdiction", "South Australia at launch. Drives which rules apply."),
            ("timezone", "Used for scheduling and follow-up timing."),
        ]),
        ("users", [
            ("id · tenant_id", "Identifier and the agency it belongs to."),
            ("email · name", "Sign-in identity."),
            ("role", "Permission level. One user at launch, but the shape is real."),
            ("provider", "Google or Microsoft sign-in."),
            ("last_login_at", "Basic security visibility."),
        ]),
        ("contacts", [
            ("id · tenant_id", "Identifier and owning agency."),
            ("first_name · last_name", "As given."),
            ("email_normalised", "Lower-cased, alias-stripped email. Deduplication key."),
            ("phone_e164", "Full international format. The other deduplication key."),
            ("secondary_email · address", "Optional additional detail."),
            ("source_channel", "How this person first arrived."),
            ("owner_user_id", "Who owns the relationship."),
            ("last_followup_at", "When they were last contacted."),
            ("last_followup_outcome",
             "What came of it — a first-class field, because it is how a day's work is "
             "prioritised."),
            ("do_not_contact", "A hard stop, independent of channel consent."),
            ("tombstoned_at",
             "Set when a privacy deletion request is honoured. Marks rather than erases, "
             "so the audit trail survives."),
        ]),
        ("contact_roles", [
            ("contact_id", "The person."),
            ("role",
             "buyer · vendor · landlord · tenant · referrer · investor · business vendor."),
            ("active_from / active_to",
             "So a role can lapse without the history being lost."),
        ]),
        ("contact_preferences", [
            ("suburbs", "Where they are looking."),
            ("price_min · price_max", "Their band."),
            ("beds_min · baths_min · parking_min", "Minimums, used as hard filters."),
            ("property_types", "House, unit, townhouse, land."),
            ("land_size_min", "Where it matters to them."),
            ("timeline", "How soon they intend to act."),
            ("finance_status", "Pre-approved, in progress, cash, unknown."),
            ("soft_requirements",
             "Free text: “quiet street, no main road”. Feeds the similarity search — "
             "this is what filters cannot capture."),
            ("embedding", "The mathematical representation used for similarity search."),
        ]),
        ("interactions", [
            ("id · tenant_id · contact_id", "Identifiers."),
            ("channel", "Email, SMS, web form, social, phone, voice note, manual."),
            ("direction", "Inbound or outbound."),
            ("occurred_at", "When it actually happened, not when it was recorded."),
            ("subject · body", "The content."),
            ("raw_s3_key",
             "Where the original message is kept, so the record has evidence behind it."),
            ("thread_ref · message_id", "For threading email conversations correctly."),
            ("listing_id", "The property being discussed, where relevant."),
            ("created_by", "The user, or the automated adapter."),
            ("tombstoned_at", "Privacy deletion marker. Rows are never removed."),
        ]),
        ("contact_intent", [
            ("contact_id", "One row per person."),
            ("intent_type", "Buying, selling, renting, investing, browsing."),
            ("budget_band · timeline", "As inferred from the conversation history."),
            ("blockers", "What is standing in the way — finance, a sale to complete."),
            ("sentiment · confidence",
             "How the relationship reads, and how sure the model is."),
            ("rolling_brief", "One paragraph on where things stand."),
            ("rebuilt_at",
             "Rebuilt from the interaction log after each new touch. Never hand-edited."),
        ]),
        ("consents", [
            ("contact_id · channel", "Who, and for what channel."),
            ("status", "Granted or revoked. A revocation is a new row."),
            ("source_form", "Which form or process captured it."),
            ("wording_shown",
             "The exact text the person agreed to. Without this a send cannot be "
             "defended."),
            ("ip_address · occurred_at", "Where and when."),
            ("evidence_s3_key", "A stored copy of the submission."),
        ]),
        ("merge_reviews", [
            ("contact_a_id · contact_b_id", "The two candidate records."),
            ("similarity", "How close the match is."),
            ("status · resolved_by", "The human decision and who made it."),
        ]),
        ("confirm_items", [
            ("kind", "Task, preference change, or intent correction."),
            ("contact_id · interaction_id", "What it came from."),
            ("proposed_json", "The change the AI is proposing."),
            ("status · committed_by · committed_at", "Whether a human accepted it."),
        ]),
    ]),
    ("Property, listings and the website", [
        ("properties", [
            ("id · tenant_id", "Identifiers."),
            ("unit · street_number · street · suburb_id · state · postcode",
             "Structured address, so search and reporting work reliably."),
            ("gnaf_pid · gnaf_matched_at",
             "Reserved for the national address identifier when that is connected."),
            ("latitude · longitude · geocoded_at",
             "Reserved for the map view. Empty until an address service is connected."),
            ("property_type", "House, unit, townhouse, land."),
            ("beds · baths · parking", "The hard filters buyers search on."),
            ("land_area_sqm · floor_area_sqm · year_built", "Physical detail."),
            ("condition · features", "Condition assessment and feature list."),
            ("owner_contact_id", "The owner, as a contact record."),
            ("internal_notes · internal_price_expectation",
             "Internal only. Structurally unable to reach a public page."),
            ("embedding", "Used to match against buyer preferences."),
        ]),
        ("listings", [
            ("id · property_id", "The campaign, and the property it is over."),
            ("listing_type", "Sale or rent."),
            ("method", "Private treaty, auction, expressions of interest."),
            ("status", "Draft, live, under offer, sold, leased, withdrawn."),
            ("price_display",
             "The advertised wording, exactly as the agent writes it. Never generated "
             "by the system."),
            ("search_price_min · search_price_max",
             "Hidden numbers that drive search filters only."),
            ("rent_pw · available_from", "For rentals."),
            ("public_headline · public_copy",
             "The website description — deliberately separate from internal notes."),
            ("slug", "The web address. Stable, and never reused."),
            ("listed_at · published_at · sold_at", "Campaign dates."),
            ("result_display", "The sale result, where the agent chooses to show it."),
        ]),
        ("listing_media", [
            ("listing_id", "The campaign."),
            ("s3_key", "Where the file lives."),
            ("kind", "Photo, floorplan, video."),
            ("sort_order", "Display order, agent-controlled."),
            ("alt_text", "Description for accessibility and search."),
        ]),
        ("inspections", [
            ("listing_id", "The campaign."),
            ("starts_at · ends_at", "When."),
            ("kind", "Open home or private viewing."),
            ("capacity", "Where it is limited."),
        ]),
        ("inspection_registrations", [
            ("inspection_id · contact_id", "Who registered for what."),
            ("registered_at",
             "Also writes an interaction, so attendance is part of the history."),
        ]),
        ("suburbs", [
            ("name · state · postcode", "Seeded for South Australia."),
            ("latitude · longitude", "For later map and radius search."),
        ]),
        ("blog_posts", [
            ("slug · title · body", "The post. Slugs match the existing site exactly."),
            ("status · published_at", "Draft, in approval, published."),
            ("legacy_url", "The original Wix address, kept so redirects are verifiable."),
        ]),
    ]),
    ("Operations, AI and the queues", [
        ("matches", [
            ("listing_id · contact_id", "The pairing."),
            ("score", "How strong the match is."),
            ("reason", "One sentence explaining it. Never blank."),
            ("stage", "Which stage of the funnel produced it."),
            ("generated_at · ai_generation_id", "Traceable back to the AI call."),
        ]),
        ("approval_items", [
            ("kind", "Email, SMS, social post, article, proposal, digest."),
            ("contact_id · listing_id", "What it concerns."),
            ("draft_subject · draft_body", "The message, editable before approval."),
            ("status", "Pending, approved, rejected, sent, blocked."),
            ("reviewed_by · reviewed_at · reject_reason", "The human decision."),
            ("sent_at · block_reason",
             "Including a lapsed consent caught at the moment of sending."),
        ]),
        ("tasks", [
            ("contact_id · title · due_at · status", "The task."),
            ("source_interaction_id",
             "What produced it — usually a voice note or an email."),
        ]),
        ("calendar_events", [
            ("user_id · provider · external_id", "The linked Google or Outlook event."),
            ("title · starts_at · ends_at", "The appointment."),
            ("contact_id · listing_id", "What it relates to."),
            ("our_write",
             "Whether the platform created it — so it never edits an appointment it "
             "does not own."),
            ("sync_token", "Used for incremental sync rather than repeated full reads."),
        ]),
        ("voice_notes", [
            ("user_id · s3_key · duration_s", "The recording."),
            ("transcript · transcribed_at", "The text, once processed."),
        ]),
        ("rag_chunks", [
            ("jurisdiction · instrument · section · heading",
             "What the citation is built from, which is why it must be right at "
             "ingest."),
            ("version_date", "The version held. Drives the monthly amendment check."),
            ("text · context_summary", "The provision, and a one-line situating note."),
            ("tsv · embedding", "The exact-terms index and the similarity index."),
        ]),
        ("ai_generations", [
            ("task · model", "What was asked, and which model answered."),
            ("prompt_hash", "So a change in instructions is traceable."),
            ("input_tokens · output_tokens · cost_aud · latency_ms",
             "What it cost and how long it took."),
            ("entity_type · entity_id", "The record it relates to."),
        ]),
    ]),
]


def appendix_a():
    h1("Appendix A.  Every table and field")

    para("Grouped by area. Field names are the technical names; the description is what "
         "each one is for. Some fields common to every table — internal identifiers, "
         "creation and update timestamps, and the agency column — are omitted from the "
         "listings below except where they carry meaning.")

    for group, entities in FIELD_REF:
        h2(group)
        for entity, fields in entities:
            h3(entity)
            table(["Field", "What it holds"],
                  [[f, d] for f, d in fields],
                  widths=[5.2, 10.8], size=8.4)


# ================================================================== APPENDIX B
def appendix_b():
    h1("Appendix B.  The existing website, URL by URL")

    para("Captured from the live sitemaps on 17 August 2026. Every one of these needs a "
         "destination decided before the switch. The blog is actively published to, so "
         "this is re-captured immediately before cutover rather than trusted as final.")

    h2("Platform")

    para("Wix. Identified from the site's own sitemap index, which exposes a Wix Blog "
         "sitemap, a Wix Bookings sitemap, and a content-collection sitemap for the "
         "property pages. Content exports to spreadsheet form; images have to be pulled "
         "separately. Nothing is portable as code — this is a content migration.")

    h2("The 22 service and information pages")

    table(["Current address", "Note"],
          [["/", "Home"],
           ["/about-adelaide-land-agent", ""],
           ["/property-services", ""],
           ["/property-strategy-services", ""],
           ["/manage-property-adelaide", "Markets property management — see section 14"],
           ["/rent-out-my-property-adelaide", "Markets property management"],
           ["/rent-property-house-adelaide", "Rentals, tenant side"],
           ["/property-rental-report", "Lead form"],
           ["/sell-property-house-adelaide", ""],
           ["/buyer-agent-adelaide", "Buyer's agency"],
           ["/property-investment", ""],
           ["/oversees-investment", "Spelling error in the address — fix and redirect"],
           ["/land-opportunities-sa-adelaide", ""],
           ["/sell-my-business-australia", "Business brokerage"],
           ["/free-property-appraisal-sa", "Lead form — highest value on the site"],
           ["/free-suburb-insight-report", "Lead form"],
           ["/adelaide-property-faq", ""],
           ["/realestate-gift-adelaide", ""],
           ["/inquiry-services-page", ""],
           ["/book-online", "Wix Bookings — live appointments, needs a decision"],
           ["/contact-adelaide-realestae-agency",
            "Spelling error in the address — fix and redirect"],
           ["/blog", "Blog index"]],
          widths=[7.0, 9.0], size=8.4)

    h2("The 4 property pages")

    table(["Current address", "Note"],
          [["/properties/8-weerana-road", ""],
           ["/properties/11-berry-fry-avenue", ""],
           ["/properties/12-powell-street", ""],
           ["/properties/greenacres", "Named by suburb rather than street"]],
          widths=[7.0, 9.0], size=8.4)

    para("Four listings only, so there is no bulk import to build — they are re-entered "
         "by hand. The new addresses follow a different pattern "
         "(/for-sale/12-smith-street-norwood-sa-5067-1234), so each needs a redirect.",
         size=9)

    h2("The 51 blog posts")

    para("All at /post/<title>. These addresses are kept exactly as they are. The full "
         "list lives in the site's own blog sitemap and is re-pulled at migration time "
         "rather than frozen into this document, because posts are still being added — "
         "one was published on the day this was captured.")

    h2("Redirect rules")

    bullets([
        "Everything forced to https and to the www address.",
        "Blog posts: address unchanged, so no redirect needed.",
        "Property pages: one redirect each to the new listing address.",
        "The 22 pages: one-to-one where an equivalent exists, otherwise to the nearest "
        "parent page — never to the home page and never to a “not found”.",
        "The two misspelled addresses: corrected on the new site, redirected from the "
        "old spelling, which is never dropped.",
        "Tracking parameters on the end of an address are ignored when matching.",
    ])


# ========================================================================= BUILD
if __name__ == "__main__":
    setup()
    footer_page_numbers()
    cover()
    contents()
    s1_summary()
    s2_what()
    s3_intake()
    s4_rules()
    s5_contacts()
    s6_stock()
    s7_matching()
    s8_website()
    s9_migration()
    s10_compliance()
    s11_rest()
    s12_phases()
    s13_tech()
    s14_scope()
    s15_decisions()
    s16_needs()
    s17_risks()
    appendix_a()
    appendix_b()
    doc.save(OUT)
    print("wrote", OUT)
    print(f"{_fignum[0]} figures, {_tabnum[0]} tables")
