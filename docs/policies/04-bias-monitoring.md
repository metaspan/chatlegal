# 04 · Bias monitoring & anti-discrimination

> **DRAFT · PLAN MODE · for review by qualified counsel · not legal advice.** ChatLegal (chatlegal.uk) · operating entity: [legal entity name · company number]. Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports TNA Q18 (regular bias review), MoJ principles 4 (Anti-discriminatory harm) and 5 (Anti-bias). Also aligns with Equality Act 2010 (services) and ICO fairness guidance.

## Where bias can enter
| Stage | Risk | Control |
|---|---|---|
| Sources | FCL is incomplete and skewed to higher courts; tribunal and county-court coverage thin; Welsh-language and Scots/NI material mixed in | Jurisdiction tags; coverage disclosure (06); never infer "typical outcomes" from FCL |
| Triage | Misclassifying users who write informally, in non-standard English, or describe disability/race issues indirectly | Paraphrase test sets; low-confidence → ask / human route |
| Retrieval | Over-retrieving cases involving particular groups | Anonymised corpus; no demographic features; retrieval audits |
| Generation | Stereotyped language; different tone/quality by perceived group; under-escalating for some users | Counterfactual testing (below); style rules |
| Escalation | Missing domestic abuse, disability, language or capacity needs | Mandatory escalation triggers on every tier |

## Testing regime
1. **Counterfactual pairs** — same scenario, vary name, gender, ethnicity cue, age, disability, religion, nationality, region, English fluency/literacy. Compare: correct cite rate, refusal rate, escalation rate, reading level, tone. Material gap = > [X] percentage points → incident.
2. **Eval pack** (5 locked stories, expanding) — run on every model/prompt/retrieval change; bias slices added per story.
3. **Accessibility** — plain-English target (reading age ~[9–11]); screen-reader compatible; Welsh-language support deferred (locked 3 Nov) — no Cymraeg footer line is shown (C-16).
4. **Live monitoring** — anonymised, aggregated metrics only from opted-in data: escalation rate, thumbs-down, complaint categories by case type. No demographic profiling of users; voluntary equality monitoring only with explicit consent [optional].

## Cadence & reporting
- Every release: automated bias suite must pass.
- Quarterly: bias report to [Ethics Reviewer] (metrics, failures, fixes).
- Annually: summary in public transparency report.

## Discriminatory-output response
User report or detection → disable affected answer pattern/leaf within [24h] → investigate → fix → add regression test → Ethics Reviewer sign-off → note in transparency report (aggregated).

## Never
- Use protected characteristics to change the legal information given (except where the law itself turns on them, e.g. Equality Act protected characteristic explanations).
- Rank, score or profile judges, courts, parties or lawyers.
