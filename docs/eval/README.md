# Eval gold pack

**Status:** DRAFT · for human + qualified counsel check · not legal advice · plan mode
**Related:** [EVAL_PACK.md](../EVAL_PACK.md) · [protocols/](../protocols/) · [REFERRALS.md](../REFERRALS.md) · [SOURCE_LICENCE_ALLOWLIST.md](../SOURCE_LICENCE_ALLOWLIST.md) · [BL-004](../backlog/BL-004-protocol-packs-eval-five.md)

## What this is

Human-checked gold *shapes* for Ash's public-case eval: one worked example per locked EVAL_PACK story. Each gold file pairs:

- a **sample user prompt** (public-case style, no real person's data);
- a **sample facts bundle** (filled protocol intake);
- a **gold answer** — the plain-English memo shape a passing model answer should follow;
- a **citations table** — every legal proposition traced to a source URL fetched and checked on the access date.

Gold answers are **not** model output and **not** legal advice. They show the *shape* (disclaimer → jurisdiction → cited information → options map → referral/escalate) and the facts that must be sourced. A model answer does not have to match the wording; it has to pass the same checks.

## How to use

1. Read the story in [EVAL_PACK.md](../EVAL_PACK.md) and its protocol in [protocols/](../protocols/).
2. Run the sample prompt + facts bundle through the candidate model.
3. Score with the **EVAL_PACK shared pass/fail** list plus the story's "Pass if" line. The reviewer checklist in each gold file mirrors those boxes.
4. Fire the must-refuse and escalate follow-ups; each must refuse or hand off.

Scoring fields stay as in EVAL_PACK: `cite_ok` · `info_mode` · `jdx` · `escalate` · `no_hallucination`.

## Files

| File | Story | Protocol |
|---|---|---|
| [gold/G01-housing-possession-notice.md](gold/G01-housing-possession-notice.md) | 1 · `s21` | `P-EW-HOUSING-POSSESSION-NOTICE` |
| [gold/G02-housing-deposit.md](gold/G02-housing-deposit.md) | 2 · `deposit` | `P-EW-HOUSING-DEPOSIT` |
| [gold/G03-employment-unpaid-wages.md](gold/G03-employment-unpaid-wages.md) | 3 · `wages` | `P-EW-EMPLOYMENT-UNPAID-WAGES` |
| [gold/G04-consumer-private-parking.md](gold/G04-consumer-private-parking.md) | 4 · `parking` | `P-EW-CONSUMER-PRIVATE-PARKING` |
| [gold/G05-welfare-uc-sanction-mr.md](gold/G05-welfare-uc-sanction-mr.md) | 5 · `uc` | `P-EW-WELFARE-UC-SANCTION-MR` |

## Rules for gold files

- Every gold file is marked **DRAFT · for human + qualified counsel check · not legal advice** until signed off (BL-004 acceptance).
- Every URL was fetched on the access date (2026-11-03). Re-fetch before lock and on each eval run if the pin is not frozen (BL-004 open question 2).
- Sources: GOV.UK, legislation.gov.uk and Acas first (allowlist #1, #17, #18). Advice charities appear only as link-out referral destinations, never as cited legal authority.
- **No Find Case Law judgment cites** until the TNA transactional licence is granted. At most a link-out to the public search page; no bulk or RAG use is claimed.
- No invented section numbers, deadlines or award figures. Anything not confirmed on a live page is marked **[verify]** and listed under *Open verify notes*. A gold file cannot move to REVIEWED while a blocking [verify] remains.
- Sample facts are fictional.
