# 02 · Ethics governance & impartial review

> **DRAFT · PLAN MODE · for review by qualified counsel · not legal advice.** ChatLegal (chatlegal.uk) · operating entity: [legal entity name · company number]. Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports TNA Q20 (impartial review against an ethical framework), Q23 (methodology for scrutiny), MoJ principles 3 (Appropriate scrutiny) and 5 (Anti-bias).

## Roles
| Role | Holder | Duties |
|---|---|---|
| Senior licence holder | [Senior licence holder], [legal entity] | Accountable for TNA licence compliance and this policy set. |
| Product owner | [Product owner] | Ships within policy; owns eval set and model changes. |
| Privacy lead / DPO | [DPO or privacy lead] | DPIA, data-subject rights, breach handling. |
| **Ethics Reviewer** (impartial) | [Ethics Reviewer] — to be appointed | Independent review against the Code of Ethics (01) and MoJ nine principles. |
| Ethics Advisory Panel (optional, scale-up) | [Panel members] | 3 people incl. at least one practising/academic lawyer and one access-to-justice or lay-user representative. |

## Independence test for the Ethics Reviewer
- Not an employee, director or shareholder of the operating entity or any partner; no fee contingent on product revenue.
- Relevant background: legal ethics, access to justice, data ethics or research ethics (e.g. university REC member, law-centre lead, retired practitioner).
- Written terms of reference; fixed fee or honorarium; can publish a dissent on the transparency page.
- Declared conflicts recorded in the register.
Interim (pre-appointment): no Find Case Law RAG goes live and no TNA form is submitted claiming Q20 = Yes until the Reviewer is appointed in writing.

## What gets reviewed
| Trigger | Review | Output |
|---|---|---|
| Before launch of any new case-type leaf/protocol | Ethics Reviewer + Legal | Approve / changes required |
| New data source or licence | Legal + allowlist update | Allowlist status |
| Model, prompt or retrieval change that alters answers | Product owner runs eval set (cite / refuse / escalate + bias slices) | Eval report; Reviewer sees regressions |
| Quarterly | Ethics Reviewer | Bias report (04), incident log, takedown log, complaints sample |
| Annually | Ethics Reviewer + Senior licence holder | Public transparency report; Code re-adopted |

## Ethical framework used
The ChatLegal Code of Ethics (01) + MoJ nine principles for Find Case Law + ICO guidance on AI and data protection + [optional: UK Government Data Ethics Framework / Algorithmic Transparency Recording Standard as a template for the methodology page].

## Incidents
An incident is: a harmful or wrong answer that a user relied on; a missed escalation; a discriminatory output; a privacy breach; a judgment shown after takedown; judgment text found indexed by a search engine; a branding/holding-out breach.
1. Log within 24h; contain (disable leaf/answer pattern or pull source) immediately.
2. Personal-data breach → DPO assesses ICO notification within 72h (UK GDPR Art 33).
3. Licence-relevant incident (takedown, indexing, re-identification) → notify TNA as the licence requires [Legal to confirm notice terms].
4. Root cause + fix + eval case added; Reviewer signs off reopening.

## Records
Decision register, incident log, eval reports, bias reports, takedown sync log — retained [retention period] and available to TNA on request.
