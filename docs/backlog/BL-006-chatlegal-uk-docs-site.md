# BL-006 — chatlegal.uk/docs site (curated laws + data sources)

**Status:** Draft backlog · plan mode · build only when authorised
**Owner:** Product (IA, curated law lists) · **Build:** Hermes · **Deploy:** Ops · **Review:** qualified counsel (law pages)
**Depends on:** [CASE_TAXONOMY.md](../CASE_TAXONOMY.md) · [SOURCE_LICENCE_ALLOWLIST.md](../SOURCE_LICENCE_ALLOWLIST.md) · [protocols/](../protocols/) ([BL-004](./BL-004-protocol-packs-eval-five.md)) · [REFERRALS.md](../REFERRALS.md) ([BL-005](./BL-005-referral-escalate-map.md))
**Plan:** [SITE_DOCS_PLAN.md](../SITE_DOCS_PLAN.md) · **Curated list:** [CURATED_LAWS.md](../CURATED_LAWS.md)

## Intent

Public docs at `https://chatlegal.uk/docs`: sections per law category with sub-pages per leaf (related laws + official guidance + what ChatLegal will / won't do), plus a data-sources section generated from the licence allowlist. Next.js + MDX, git-backed, no database for v0. Chat at `app.chatlegal.uk` is a later milestone.

## Scope

1. Next.js App Router + MDX docs app (Hermes), IA per plan §B.
2. Build-time render of CURATED_LAWS and allowlist tables from this repo (no hand-copied licence table).
3. Leaf + hub templates; five `eval:locked` leaves filled; `planned` stubs.
4. `/docs/sources` grouped by status; build blockers surfaced; attribution page.
5. `/docs/referrals`, `/docs/policies` summaries, `/docs/for-agents` + `/llms.txt`.
6. Outbound link check in CI.
7. Ops: DNS, TLS, deploy pipeline, preview envs; reserve `app.chatlegal.uk`.

## Out of scope

Chat / RAG UI · solicitor service · CAB or advice-agency branding · BLOCKED source text · Find Case Law judgment text.

## Acceptance

- See plan §I success criteria.
- Not-legal-advice banner on every major page.
- Sponsor named only in CONTRIBUTORS.

## Open decisions

See plan §H (repo name, framework, hosting, ship-before-chat, sync method, reviewed-badge bar).
