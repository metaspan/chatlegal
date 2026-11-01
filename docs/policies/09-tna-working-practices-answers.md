# 09 · TNA Find Case Law licence — proposed working-practices answers (Q16–28) + nine-principles outline

> **DRAFT · PLAN MODE · for Legal review · not legal advice.** Metaspan Ltd ([company number]), trading as ChatLegal (chatlegal.uk). Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Form: https://caselaw.nationalarchives.gov.uk/apply-for-a-licence (6 sections, 29 questions, one sitting, no save). Questions confirmed from https://caselaw.nationalarchives.gov.uk/what-you-need-to-apply-for-a-licence on 1 Nov 2026. Contact: caselawlicence@nationalarchives.gov.uk.

> **Legal-review callout — before applying:** email caselawlicence@nationalarchives.gov.uk describing the triage + options-map + escalation design and asking whether TNA regards it as Q25 option 3 ("directly inform or influence the decision of a third-party whether to pursue justice or legal action"). Also ask how Q21 should be answered where we only link to the full FCL judgment. Do not submit until answered.

## Proposed answers
| Q | Question (short) | Proposed | Basis / where documented |
|---|---|---|---|
| 16 | Focus on specific individuals or groups? | **No** | General public legal-info product; analysis by legal issue, not people. 03 §A1, 01 #6 |
| 17 | Anonymise individuals before analysis? | **Yes** | Names/identifiers replaced with role tokens before chunking/embedding; neutral citations kept; link to FCL. 03 §A2 |
| 18 | Regularly review algorithms for bias? | **Yes** | Counterfactual suite per release; quarterly report to Ethics Reviewer. 04 |
| 19 | Abide by a code of ethics? | **Yes** | ChatLegal Code of Ethics. 01 |
| 20 | Impartial party review against ethical framework? | **Yes** — *conditional on appointing* [Ethics Reviewer] before submission | 02 |
| 21 | Make the entire record available online? | **No** (proposed) — we signpost/link to FCL full judgment; we do not host it. *Form example implies signposting may count — confirm with TNA.* | 07 |
| 22 | Data extracted published online? | **Yes, limited** — form is Yes/No; citations and jurisdiction tags appear in answers, so answer Yes and explain: no bulk text, no entity lists, aggregates only if anonymised | 07 |
| 23 | Methodology available for scrutiny? | **Yes** | Public "How ChatLegal works" page + annual transparency report. 05, 02 |
| 24 | Analyse and publish findings online? | **No at launch** (proposed). If research notes are later published: anonymised aggregates only, Ethics Reviewer approval, notify TNA | 07 |
| 25 | High-risk uses? | **"None of the above"** — *only after TNA confirms*; else tick option 3 and rely on mitigations (no advice, no prediction, escalation, human routes) | 05, 01 #1–4 |
| 26 | Notify people of GenAI use? | **Yes** | Every session and answer labelled. 05 |
| 27 | Explain FCL collection limits? | **Yes** | 06 |
| 28 | Accept nine principles as licence terms? | **Yes** | This policy set |

## Other form fields (placeholders)
- Q1–3: Main contact [Main contact name/email]; Licence holder [Senior licence holder name/email].
- Organisation: Metaspan Ltd; other names: ChatLegal; country: [England & Wales]; address [registered address]; type: private limited company; identifier [company number]; partners: [none / list model vendors only if they perform analysis].
- Q10: ChatLegal. Q11: https://chatlegal.uk. Q13: Public access (Free tier) — [Legal: or "Other" given paid tiers].

## Draft public statement (Q12/Q15, ~150 words)
ChatLegal (Metaspan Ltd) helps ordinary people in England and Wales understand everyday legal problems — housing, employment, money, consumer and benefits — when they cannot easily reach a lawyer. It is free or low-cost. Users describe their situation; ChatLegal identifies the type of issue and explains, in plain English, the relevant law, key deadlines and the options available, citing legislation, official guidance and published judgments, and directing people to advisers, solicitors or courts where needed. It does not give legal advice or predict case outcomes. We will use natural-language processing and retrieval over anonymised Find Case Law judgments so that explanations can point to real, current authority, always linking to the full judgment on Find Case Law. Judgment text is never indexed by search engines. Our methodology, ethics code and the limits of the collection are published, and an independent reviewer audits our work. *(≈150 words — trim at final)*

## Nine-principles statement — outline (Q29)
1. **Dignity of the court** — neutral, accurate descriptions; no judge/court rankings or ridicule; cite-or-refuse; escalate to proper court routes. (01 #5)
2. **Independence of the court** — no outcome prediction; no profiling of judges; nothing designed to influence decisions; summaries reflect the court's reasoning without editorialising. (01 #3, #6)
3. **Appropriate scrutiny** — acknowledge incomplete dataset; jigsaw-identification controls; link-only for family/CoP/youth/sexual-offence/asylum; Ethics Reviewer audits. (03 §A2, 06)
4. **Anti-discriminatory harm** — counterfactual bias tests; user reporting; 24h disable-investigate-fix loop. (04)
5. **Anti-bias** — governance cadence; eval on every change; quarterly Reviewer report. (02, 04)
6. **Personal privacy** — anonymise before analysis; UK GDPR controller obligations met independently; licence is not a data-sharing/processing agreement; user data opt-in only for improvement, separate encrypted corpus. (03, 08)
7. **Discoverability** — noindex/X-Robots-Tag on any page with judgment text; extracts behind session; robots/AI-crawler blocks; quarterly index check. (07)
8. **Algorithmic transparency** — GenAI disclosed on every answer; public methodology; source citations on every claim. (05)
9. **Accurate data representation** — daily version sync; takedown purge in 24h; nightly citation revalidation; no statistics claims from FCL. (06)

## Open items for Derek / Legal
| # | Item | Owner |
|---|---|---|
| 1 | Appoint impartial [Ethics Reviewer] (and decide on 3-person panel). Q20 depends on it | Derek + Legal |
| 2 | Email TNA re Q25 (option 3 risk) and Q21 (signposting) before applying | Legal |
| 3 | [Senior licence holder] and [Main contact] names/emails | Derek |
| 4 | Metaspan Ltd [company number], [registered address], ICO registration [ICO reg no.] | Derek |
| 5 | [DPO or privacy lead]; privacy email | Derek + Legal |
| 6 | Lawful bases for service (Free tier) and Art 9 condition | Legal |
| 7 | Sub-processors (LLM, embeddings, hosting region), IDTA/transfer mechanism, zero-retention terms | Derek |
| 8 | Retention periods (sessions, corpus, raw judgments, logs) | Legal |
| 9 | Pro/team: controller/processor split and admin powers | Legal |
| 10 | Age gate 18+ | Legal |
| 11 | Q13 access answer given paid tiers; Q24 publish findings yes/no | Derek |
| 12 | Referral/partner model vs LASPO s.56 and SRA rules; PI insurance | Legal |
| 13 | Confirm FCL coverage statement wording for 06 | Legal / TNA |
| 14 | Note: repo docs will be public — keep placeholders, no personal contact details until approved | Derek |
