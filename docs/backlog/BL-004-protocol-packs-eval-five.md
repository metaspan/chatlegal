# BL-004 — Protocol packs: eval five

**Status:** Draft backlog · plan mode · not for build yet  
**Owner:** Product (ChatLegal) · qualified counsel (review of gold answers)  
**Depends on:** [BL-001](./BL-001-case-work-area.md) work area (intake fields, dates, tasks) · [SOURCE_LICENCE_ALLOWLIST.md](../SOURCE_LICENCE_ALLOWLIST.md) · TNA transactional licence before any Find Case Law cite in RAG (allowlist #5)  
**Related:** [protocols/](../protocols/) · [EVAL_PACK.md](../EVAL_PACK.md) · [CASE_TAXONOMY.md](../CASE_TAXONOMY.md) · [BL-003](./BL-003-guardrails-safety.md)

## Intent

Review and, once plan mode is lifted, implement the five draft protocols that match the locked eval stories. Together they are the **Ash eval surface** — the first set of leaves ChatLegal is measured on (eval framing credit in [CONTRIBUTORS.md](../../CONTRIBUTORS.md)).

| Protocol | Eval story |
|---|---|
| [P-EW-HOUSING-POSSESSION-NOTICE](../protocols/P-EW-HOUSING-POSSESSION-NOTICE.md) | `s21` |
| [P-EW-HOUSING-DEPOSIT](../protocols/P-EW-HOUSING-DEPOSIT.md) | `deposit` |
| [P-EW-EMPLOYMENT-UNPAID-WAGES](../protocols/P-EW-EMPLOYMENT-UNPAID-WAGES.md) | `wages` |
| [P-EW-CONSUMER-PRIVATE-PARKING](../protocols/P-EW-CONSUMER-PRIVATE-PARKING.md) | `parking` |
| [P-EW-WELFARE-UC-SANCTION-MR](../protocols/P-EW-WELFARE-UC-SANCTION-MR.md) | `uc` |

## Scope

1. **Review** each protocol against its EVAL_PACK story (intake, steps, refuse, escalate, pass criteria). EVAL_PACK wins on conflict.
2. **Gold answers** — one human-written, cited memo per story matching the ideal shape, using the EVAL_PACK item template (`user_prompt`, `gold_answer`, `must_cite`, `must_refuse`, `must_escalate`).
3. **Cite verification** — every pinpoint in a gold answer checked against the live allowlisted source for the eval date; must-cite classes only otherwise.
4. **Adversarial follow-ups** — at least one refuse and one escalate follow-up per story.
5. **Work-area wiring (when authorised)** — protocol intake fields drive BL-001 questionnaire; missing required fields become tasks.
6. **Safety overlay** — BL-003 triggers override any protocol step.

## Acceptance

- Five gold answers written and **human-checked** (product + qualified counsel) against EVAL_PACK.
- Each gold `must_cite` lists only allowlisted URIs actually used; no BLOCKED source ingested or quoted.
- No Find Case Law citation in any gold answer until the TNA transactional licence is granted (link-out at most).
- Each protocol's eval pass criteria map to the shared scoring fields: `cite_ok` · `info_mode` · `jdx` · `escalate` · `no_hallucination`.
- Protocol status moves DRAFT → REVIEWED only after the above.

## Non-goals

- New leaves beyond the five (see `planned` stubs in CASE_TAXONOMY).
- Scotland / NI variants (`P-SCT-…`, `P-NIR-…`).
- Any live legal advice or representation features.

## Open questions

1. Who signs off gold answers on the counsel side, and how often are they re-verified?
2. Eval date pinning: do gold answers freeze source versions, or re-validate on each run?
3. Pass threshold per story vs across the set?
