# BL-001 — Case work area / collaboration space

**Status:** Draft backlog · plan mode · not for build yet  
**Owner:** Product (ChatLegal)  
**Depends on:** Case model (Category → leaf → protocol); privacy tiers & opt-in corpus ([policies/08](../policies/08-privacy-tiers-improvement-data.md)); source allowlist for any cited law

## Intent

Each case session has a **work area** (collaboration space) where the user (and later invited helpers/advisers) collect facts, documents, and dates. The work area feeds the protocol: key dates, options map, and escalate/refer — without turning ChatLegal into reserved legal work.

## Client discovery questionnaire

Structured intake for the leaf case type, plus common fields across all categories:

| Field group | Captures |
|---|---|
| Parties | All parties in the case — full name / org name, role (claimant, defendant, landlord, employer, …), **address** |
| Other properties | Any other properties tied to the dispute — **address** |
| Locus | Location of the case / offence / grievance (address or description + jurisdiction tag `EW` \| `SCT` \| `NIR`) |
| Known key dates | User-supplied dates (notice served, injury, decision letter, hearing, limitation guess, …) with source (“from letter”, “from memory”) |
| Documents | Upload area (see below) |
| Category tags | Leaf case type + free/structured tags (e.g. `deposit`, `s21-transition`, `uc-sanction`) |

Questionnaire should be **protocol-aware**: after leaf selection, show the fields that protocol needs; hide irrelevant ones. Missing required answers become **tasks** (below).

## Document upload → OCR → entity extraction

User uploads PDFs/images (notices, contracts, letters, screenshots).

Pipeline (plan only):

1. **OCR** — extract text (and retain original file encrypted at rest).
2. **Identify entities** — people, companies, locations, dates, rights & obligations (clause-level where possible).
3. **Propose fills** — suggest questionnaire fields and timeline events; user confirms before write.
4. **Category tags** — suggest leaf / tags from content; user confirms.

Constraints:

- GenAI disclosure on OCR/extraction steps ([policies/05](../policies/05-genai-disclosure.md)).
- Personal data minimisation; no opted-out text in public RAG ([policies/08](../policies/08-privacy-tiers-improvement-data.md)).
- Extraction is **assistive** — never auto-file court forms or send letters.
- Confidence scores; low-confidence entities stay as “review” tasks.

## Timeline — past & future plan

For each case, maintain a single timeline:

- **Past** — confirmed events (from questionnaire, OCR, or user edits).
- **Future plan** — protocol-derived next steps and statutory/soft deadlines where facts support them (labelled as information, with uncertainty when facts are incomplete).

Every timeline item: date (or range), label, source (user / document / derived), confidence, editable.

Jurisdiction-tagged; never mix Scots/NI procedure into E&W timelines.

## Task list for gaps

Anything missing that blocks a useful memo or a safe date calculation becomes a **user task**:

- Missing party address
- Missing locus / jurisdiction
- Missing date that protocol needs (e.g. decision-letter date for MR clock)
- Unconfirmed OCR entity
- Document requested but not uploaded

Tasks link back to the questionnaire field or document slot. Completing a task re-runs date derivation and refreshes the timeline.

## Collaboration (later)

v0: single-user work area.  
Later: invite co-user / adviser with roles; audit log; no change to “not a solicitor” rails.

## Acceptance criteria (when build is authorised)

1. User can complete discovery questionnaire for at least the five [EVAL_PACK](../EVAL_PACK.md) leaves.
2. Upload → OCR → proposed people/companies/locations/dates/rights-obligations → user confirm.
3. Category tags editable; leaf reclassification supported with triage note.
4. Timeline shows past events + future plan items derived from protocol + facts.
5. Missing dates/answers create a clear task list; clearing a task updates timeline.
6. All GenAI steps disclosed; opted-out data never leaves private store into public RAG.

## Out of scope (for this item)

- Court filing, ET1/claim drafting, or solicitor representation
- Automatic emails/letters to other parties
- Ingest of BAILII / JCG / blocked sources into the work area knowledge base

## Open questions

1. Max upload size / virus scan / retention of originals vs OCR text only?
2. Which OCR + NER stack (and UK hosting / zero-retention contracts)?
3. Shared work area roles for Pro/team tier?
4. How hard we push address capture for GDPR minimisation vs protocol need?
