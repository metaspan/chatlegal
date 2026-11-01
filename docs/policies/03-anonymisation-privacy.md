# 03 · Anonymisation & personal privacy (judgments + users)

> **DRAFT · PLAN MODE · for review by qualified counsel · not legal advice.** ChatLegal (chatlegal.uk) · operating entity: [legal entity name · company number]. Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports TNA Q16 (no focus on individuals), Q17 (anonymise before analysis), MoJ principles 3 (Appropriate scrutiny — jigsaw identification) and 6 (Personal privacy). The FCL licence **is not a data-sharing agreement and not a processing agreement for personal data**; The operating entity is controller in its own right for any personal data it processes and must meet UK GDPR / DPA 2018 independently.

## Part A — Judgments and decisions (Find Case Law, SCTS, Judiciary NI, tribunals)

### A1. No focus on individuals
- Analysis is of legal principles, procedure and outcomes **by issue type**, never by named party, witness, lawyer or judge.
- Prohibited features: search by person name; party/judge profiles; "litigant history"; judge or court league tables; any entity list of people.

### A2. Anonymise before analysis (pipeline rule)
Before any judgment text is chunked, embedded, indexed or passed to a model for analysis:
1. **Ingest** current version from FCL API (XML/LegalDocML) into a private raw store (access-controlled, not public, not crawlable).
2. **Detect** personal names and identifiers — parties, witnesses, children, addresses, dates of birth, NI numbers, vehicle registrations, employer names where the employer is an individual/sole trader, case-specific small-place names. Use structured LegalDocML party/role markup + NER + rules.
3. **Replace** with role tokens: `[Claimant]`, `[Respondent]`, `[Child A]`, `[Witness 1]`, `[Address]`. Keep: neutral citation, court, date, judge role ("the Judge") not name, statutory references, legal reasoning.
4. **Honour existing anonymisation** — never reverse initials, ciphers or anonymity orders; treat any reporting-restriction marker as "do not process beyond link".
5. **Jigsaw check** — strip combinations (occupation + small town + date + rare condition) that could re-identify; family, Court of Protection, youth, sexual-offence and immigration-asylum material is **link-only** (no chunking) by default.
6. **QA** — sample [N]% per batch for residual names; fail the batch if recall below [threshold, e.g. 99%]. Log metrics for the Ethics Reviewer.
7. **Embed/index** only the anonymised text. Raw text is kept only as long as needed to re-run anonymisation and takedown checks ([retention period]).

### A3. What users see
- Short anonymised extracts with neutral citation **plus a link to the authoritative FCL page** for the full judgment.
- We never host the full judgment body as our own page (see 07).

### A4. Takedowns and corrections
Daily revalidation against FCL; withdrawn or revised judgments removed from raw store, index and caches within [24h] of detection (see 06).

## Part B — Users of chatlegal.uk

### B1. Roles
The operating entity is controller. LLM, embedding, hosting and analytics vendors are processors under Art 28 contracts — [list sub-processors]. No vendor may train on user data (zero-retention / no-training terms required).

### B2. Data we collect
Account (email, tier, payment via [payment processor] — we do not store card numbers); session content (the user's situation, questions, uploaded letters); safety flags; usage logs. Users are told not to upload others' sensitive data unless needed.

### B3. Special category & criminal-offence data
Users will disclose health, ethnicity, religion, sexuality, criminal allegations, children's details. Lawful basis:
- **Providing the service:** Art 6(1)(b) contract (Paid/Pro) / Art 6(1)(f) legitimate interests (Free) — [Legal to confirm]; Art 9(2)(a) explicit consent captured at session start for special-category content, or Art 9(2)(f) where in connection with legal claims — [Legal to confirm which condition and DPA 2018 Sch 1 conditions for criminal-offence data].
- **Improvement data:** explicit consent only (Free opt-in / Paid & Pro opt-in toggle). See 08.
A DPIA is mandatory before build (large-scale special category + innovative technology).

### B4. Rights
Access, rectification, erasure, restriction, objection, portability; withdraw consent anytime (equally easy as giving it). Response within one month. Contact: [privacy email]. Complaint route: ICO.

### B5. Automated decision-making
ChatLegal makes no decision with legal or similarly significant effect about a user (Art 22). Triage classifies the issue to pick an information protocol; the user can change the category at any time and request a human route.

### B6. Security
Encryption in transit (TLS 1.2+) and at rest; opt-in case corpus in a separate encrypted store with separate keys and access roles; least-privilege access; access logging; pen test before launch; breach procedure in 02.

### B7. Age
Service is for adults (18+) at launch [Legal to confirm]; under-18 issues signposted to appropriate services. If under-18 use is permitted later, ICO Age Appropriate Design Code applies.
