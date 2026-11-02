# Protocol packs

**Status:** DRAFT · plan mode · not for build · not legal advice  
**Related:** [EVAL_PACK.md](../EVAL_PACK.md) · [CASE_TAXONOMY.md](../CASE_TAXONOMY.md) · [SOURCE_LICENCE_ALLOWLIST.md](../SOURCE_LICENCE_ALLOWLIST.md) · [BL-001](../backlog/BL-001-case-work-area.md) · [BL-004](../backlog/BL-004-protocol-packs-eval-five.md)

## What a protocol is

ChatLegal's case model is **Category → leaf → Protocol**.

- **Category** — broad problem area (Housing, Employment, Consumer/debt, Welfare, …).
- **Leaf** — one specific case type inside a category (e.g. tenancy deposit protection). See [CASE_TAXONOMY.md](../CASE_TAXONOMY.md).
- **Protocol** — the product spec for how ChatLegal handles that leaf: what to ask, which dates matter, what sources it must cite, what it refuses, and when it hands off.

A protocol is a **product specification**, not legal advice and not a script of legal conclusions. Every protocol does three things only: **information**, **triage**, and **escalate/refer**. It never does reserved or representation work (drafting pleadings or claim forms, acting for the user, guaranteeing outcomes).

## Common step shape

Every protocol follows the same five steps (from [PROJECT_BRIEF.md](../PROJECT_BRIEF.md)):

1. **Intake** — not-a-solicitor notice, jurisdiction check (`EW` / reclassify `SCT` / `NIR`), structured fields.
2. **Facts / dates** — collect and confirm key dates; unknowns become open checks or work-area tasks (BL-001).
3. **Cited info memo** — plain-English information with a cite from an allowlisted source for every legal proposition, or a refusal.
4. **Options map** — the routes that generally exist (informal, scheme/ADR, official review, tribunal/court) as information, not a recommendation for *this* case.
5. **Escalate / refer** — tripwires that stop self-help and point to an adviser, official body, or human.

## Index (EW, eval:locked)

| ID | Category | Leaf | Eval story | Status |
|---|---|---|---|---|
| [P-EW-HOUSING-POSSESSION-NOTICE](./P-EW-HOUSING-POSSESSION-NOTICE.md) | Housing | Possession notice / s.21 transition | `s21` | DRAFT |
| [P-EW-HOUSING-DEPOSIT](./P-EW-HOUSING-DEPOSIT.md) | Housing | Tenancy deposit protection | `deposit` | DRAFT |
| [P-EW-EMPLOYMENT-UNPAID-WAGES](./P-EW-EMPLOYMENT-UNPAID-WAGES.md) | Employment | Unpaid wages / Acas early conciliation clock | `wages` | DRAFT |
| [P-EW-CONSUMER-PRIVATE-PARKING](./P-EW-CONSUMER-PRIVATE-PARKING.md) | Consumer/debt | Private parking charge challenge path | `parking` | DRAFT |
| [P-EW-WELFARE-UC-SANCTION-MR](./P-EW-WELFARE-UC-SANCTION-MR.md) | Welfare | UC sanction / mandatory reconsideration | `uc` | DRAFT |

These five map one-to-one to the locked stories in [EVAL_PACK.md](../EVAL_PACK.md). The eval pack is the acceptance source; if a protocol and the eval pack disagree, the eval pack wins until it is formally revised.

## Citation rule

Protocols name **must-cite source classes**, not pinpoint citations. A pinpoint (section, regulation, paragraph) is only used in a gold answer once it has been verified against the live source for the user's dates. Find Case Law material is cited only when licensed (see allowlist rows 4–5). Blocked sources (Shelter, Citizens Advice, POPLA, IAS, BAILII, …) are link-out only and never ingested.

## Naming

`P-<JDX>-<CATEGORY>-<LEAF>` · e.g. `P-EW-HOUSING-DEPOSIT`. Scottish or NI variants get their own ID (`P-SCT-…`, `P-NIR-…`) rather than branches inside an EW protocol.
