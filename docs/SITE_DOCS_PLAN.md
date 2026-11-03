# chatlegal.uk/docs — site docs plan

**Status:** DRAFT · plan mode · not legal advice · no app code in this repo yet
**Owner:** Product (IA + curated law lists) · **Build:** Hermes · **Deploy:** Ops · **Review:** qualified counsel (law pages)
**Backlog:** [BL-006](backlog/BL-006-chatlegal-uk-docs-site.md)
**Inputs:** [CASE_TAXONOMY.md](CASE_TAXONOMY.md) · [SOURCE_LICENCE_ALLOWLIST.md](SOURCE_LICENCE_ALLOWLIST.md) · [protocols/](protocols/) · [eval/gold/](eval/gold/) · [REFERRALS.md](REFERRALS.md) · [policies/](policies/) · [CURATED_LAWS.md](CURATED_LAWS.md)

> **Not a solicitor. Not legal advice.** This banner (or equivalent) goes on every major docs page: overview, category hubs, leaf law pages, sources hub, referrals.

---

## A. Goals & non-goals

**Goals**
- Public, curated **law + data-source docs** at `https://chatlegal.uk/docs`.
- **Citizen-readable:** short pages, plain English first, legal names second.
- **Cite-first:** every law page lists the instruments and official guidance it relies on, with links to legislation.gov.uk, GOV.UK and Acas.
- **Licence-honest:** the sources section shows the allowlist status of every source (ALLOW / AWC / APPLY_FIRST / BLOCKED / UNCLEAR) and why.
- **Machine-readable:** `llms.txt` and a plain index so agents and search tools can find pages without scraping chrome.

**Non-goals (this milestone)**
- Live chat, RAG UI or any model output on the site (that is `app.chatlegal.uk`, later).
- A solicitor service, case-specific advice, or "is my notice valid" verdicts.
- Citizens Advice / CAB branding, or implying affiliation with any advice agency.
- Ingesting or quoting BLOCKED sources (BAILII, JCG, OIC, Shelter, Citizens Advice, Advicenow, Housing Rights NI, POPLA, IAS, FOS). Link-out only.
- Find Case Law judgment text on the site until the TNA transactional licence question is settled (and even then `noindex`).

## B. Information architecture

Format parity with a product-docs pattern (top-level sections, each with short sub-pages, a "Start here" entry, flat sidebar, `llms.txt`). Format only — no product coupling or third-party branding on ChatLegal pages.

### Proposed URL tree

```
/docs                              Overview · Start here · not-legal-advice banner
/docs/how-it-works                 Protocols, triage, cites, jurisdictions (EW / SCT / NIR)
/docs/housing                      Category hub
/docs/housing/possession-notice    eval:locked
/docs/housing/deposit              eval:locked
/docs/housing/disrepair            planned stub
/docs/housing/rent-increase        planned stub
/docs/housing/illegal-eviction     planned stub (hard-escalate callout)
/docs/housing/neighbour-nuisance   planned stub
/docs/housing/boundary             planned stub
/docs/employment                   Category hub
/docs/employment/unpaid-wages      eval:locked
/docs/employment/dismissal         planned stub
/docs/employment/redundancy        planned stub
/docs/employment/harassment-discrimination  planned stub
/docs/employment/holiday-sick-pay  planned stub
/docs/consumer                     Category hub (Consumer/debt)
/docs/consumer/private-parking     eval:locked
/docs/consumer/council-pcn         planned stub
/docs/consumer/faulty-goods        planned stub
/docs/consumer/bailiffs            planned stub
/docs/consumer/credit-complaints   planned stub
/docs/welfare                      Category hub
/docs/welfare/uc-sanction-mr       eval:locked
/docs/welfare/pip-refusal          planned stub
/docs/welfare/tribunal-appeal      planned stub
/docs/welfare/overpayment          planned stub
/docs/sources                      Data sources hub (from allowlist, grouped by status)
/docs/sources/legislation          legislation.gov.uk API + feeds, CPR text (OGL)
/docs/sources/govuk-acas           GOV.UK Content/Search API, Acas, judiciary.uk, gov.scot, mygov.scot, nidirect
/docs/sources/find-case-law        OJL live lookup (AWC) + transactional licence (APPLY_FIRST)
/docs/sources/courts-tribunals     UKSC, SCTS, Judiciary NI, ET / UT AAC decisions (UNCLEAR bulk)
/docs/sources/link-out-only        BLOCKED + UNCLEAR list and why
/docs/sources/attribution          OGL / OJL attribution patterns used on the site
/docs/referrals                    Where to get human help (from REFERRALS.md), hard-escalate block first
/docs/policies                     Short summaries of policies 01–09 → links to GitHub
/docs/for-agents                   llms.txt pointer, machine-readable index, citation rules
```

Sidebar groups (top to bottom): **Overview** (Overview, How it works) · **Law** (Housing, Employment, Consumer/debt, Welfare) · **Sources** · **Help** (Referrals) · **Governance** (Policies, For agents). Within each category, `eval:locked` leaves sort first, then `planned`.

Other v0 categories in [PROJECT_BRIEF.md](PROJECT_BRIEF.md) (Personal injury, Family, Immigration, Crime, Other) do **not** get pages in this milestone. Immigration, crime and children-related content appears only as hard-escalate links on `/docs/referrals`.

### Category hub template
1. One-paragraph scope + jurisdiction tags.
2. Leaf list (status badge: `reviewed` / `draft` / `planned`).
3. Key instruments for the category (from [CURATED_LAWS.md](CURATED_LAWS.md)).
4. Where to get help (rows from REFERRALS).
5. Not-legal-advice banner.

### Leaf law page template
1. **Plain-English scope** + jurisdiction tags (`EW`, `E`-only, Wales fork, `SCT`/`NIR` re-tag pending).
2. **Related legislation** — curated Acts/SIs with legislation.gov.uk links. Names only; pinpoint sections only where already in repo protocols/gold, else `[verify]`.
3. **Official guidance** — GOV.UK / Acas pages (from gold source tables, with access date).
4. **What ChatLegal will / won't do** — information vs refuse list; escalate triggers → REFERRALS rows.
5. **Protocol / eval link** — GitHub links to `protocols/P-…` and `eval/gold/G0x` where `eval:locked`.
6. **Last reviewed** — date + reviewer role (Product / counsel). No `reviewed` badge without counsel spot-check.

Footer on every leaf: OGL attribution (legislation.gov.uk wording for statute; GOV.UK wording for guidance) + not-legal-advice line.

## C. Content pipeline

- **Source of truth:** markdown in this public GitHub repo — `docs/protocols/`, `CASE_TAXONOMY.md`, `CURATED_LAWS.md`, `SOURCE_LICENCE_ALLOWLIST.md`, `REFERRALS.md`, `eval/gold/`, `policies/`.
- **Website repo:** Next.js MDX app that **imports or syncs** from this public docs repo. Options (open decision, see H):
  1. Build-time fetch of raw markdown from GitHub (simplest; no submodule pain).
  2. Git submodule / subtree of this repo as `content/`.
  3. Monorepo: site lives in this repo under `site/`.
- **Tables are generated, not retyped.** The `/docs/sources` pages and leaf "related legislation" tables are rendered by parsing `SOURCE_LICENCE_ALLOWLIST.md` and `CURATED_LAWS.md` at build time. Hand-written MDX holds only the prose (scope, will/won't).
- **Link health:** CI job fetches every outbound URL (same rule as BL-005: dead links removed, not guessed); failures block the deploy, not the merge.
- **Editorial roles:** Product owns IA and curated law lists · counsel review before any gold / `reviewed` claim · Hermes owns the site code · Ops owns DNS, hosting, deploy.

## D. Curated laws workstream

- **Machine table:** [CURATED_LAWS.md](CURATED_LAWS.md) — `Category | Leaf | Instrument | Extent | URL | Notes`. This is the curated list of laws; the site renders from it.
- **Phase 1 (this commit = seed):** five `eval:locked` leaves, using only instruments already named in EVAL_PACK / protocols / gold. `[verify]` where pinpoints are unknown. No invented section numbers.
- **Phase 2:** `planned` taxonomy leaves get short hub stubs (scope + "coming soon" + referrals). Instruments added only after a source check, each row dated.
- **Phase 3:** Scotland (`SCT`) and NI (`NIR`) splits as separate leaf IDs and pages — never mixed into EW pages.
- **Rule:** a row only enters CURATED_LAWS with a working legislation.gov.uk (or official) URL and an access date.

## E. Data sources workstream

- Render the allowlist as `/docs/sources/*`, grouped by status: **AWC** (what we can use and on what conditions) · **APPLY_FIRST** (Find Case Law computational analysis) · **BLOCKED** (link-out only + reason) · **UNCLEAR** (what we've asked whom).
- Surface the five **build blockers** prominently on the hub: TNA transactional licence · BAILII · Judicial College Guidelines · Official Injury Claim (note: no linking without consent — the site must not link OIC) · advice-charity / ADR content.
- **Attribution patterns** page:
  - legislation.gov.uk: "© Crown and database right. Derived from content available under the Open Government Licence v3.0 from legislation.gov.uk."
  - GOV.UK / Acas: "Contains public sector information licensed under the Open Government Licence v3.0."
  - Find Case Law (if shown): "Contains information licensed under the Open Justice Licence v2.0." + licence link; page `noindex`.
- No logos, Royal Arms or crests from source sites; no implied endorsement.

## F. Tech stack

- **Next.js (App Router) + MDX.** Docs chrome via **Fumadocs** (recommended) or a Nextra-like setup: sidebar, client-side search, heading anchors, prev/next, dark mode.
- **Static export** (or SSR) on Ops' chosen host. **No database for v0** — git-backed MDX is the CMS.
- **Later, only if git MDX becomes painful:** Postgres for an editorial CMS, review workflow or link-health history.
- **Hosts:** `chatlegal.uk` (marketing + `/docs`). `app.chatlegal.uk` **reserved** for the chat app (later milestone; not built here).
- **`/llms.txt`** at site root (+ optional `/llms-full.txt`): title, one-line purpose, not-legal-advice line, links to every docs page and the GitHub source.
- **Analytics / privacy:** align with [policies/08](policies/08-privacy-tiers-improvement-data.md) — privacy-preserving, cookieless analytics or none; no third-party trackers on law pages.
- **SEO:** law and source pages indexable; any page that ever shows judgment text gets `noindex` (OJL).

## G. Delivery plan (roles)

| Milestone | Owner | Outcome |
|---|---|---|
| Hermes M1 | Hermes | Scaffold Next.js + MDX docs app; sidebar IA per §B; placeholder pages with banner; CI with preview builds |
| Product M1 | Product | CURATED_LAWS seed (this commit) + mapping of allowlist rows → `/docs/sources/*` pages |
| Hermes M2 | Hermes | Content sync from this repo; table renderers for CURATED_LAWS + allowlist; leaf + hub templates; link checker; `llms.txt` |
| Ops M1 | Ops | DNS for `chatlegal.uk`, deploy pipeline, TLS, preview environments; reserve `app.chatlegal.uk` |
| Product M2 | Product | Fill five locked leaf pages from gold/protocols; planned stubs; referrals page |
| Counsel | Qualified counsel | Spot-check law pages before any `reviewed` badge; clear the four open gold blockers |
| Later | Hermes / Ops | `app.chatlegal.uk` chat (separate milestone) |

## H. Open decisions (for Derek)

1. **Website repo:** new `chatlegal-web` repo in the same GitHub org (recommended: clean separation, content pulled from this repo) vs monorepo `site/` folder here.
2. **Docs framework:** Fumadocs (recommended) vs Nextra vs custom MDX layout.
3. **Hosting target:** same host/pattern as existing Ops deployments vs a separate host for ChatLegal.
4. **Sequencing:** does `/docs` ship publicly before any chat exists? (Recommendation: yes — it is the credibility layer and costs no inference.)
5. **Content sync method:** build-time fetch vs submodule vs monorepo (follows from 1).
6. **"Reviewed" badge:** what level of counsel check is needed before a page can show it?

## I. Success criteria

- A citizen can open `/docs/housing/deposit` and see: plain-English scope, related laws (Housing Act 2004 deposit provisions), GOV.UK links, and what ChatLegal won't do / where to escalate.
- `/docs/sources` statuses match `SOURCE_LICENCE_ALLOWLIST.md` exactly (generated, not hand-copied).
- No BLOCKED source body text ingested or quoted anywhere on the site; no link to OIC.
- Not-legal-advice banner on every major page; no claim of solicitor or advice-agency status.
- Sponsor appears only in CONTRIBUTORS; no sponsor-as-lawyer claim on the site.
- All outbound links pass the link check on deploy.
