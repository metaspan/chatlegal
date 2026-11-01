# BL-002 — Solution technical component design

**Status:** Draft backlog · plan mode · not for build yet  
**Owner:** Product + Dev (when authorised)  
**Related:** [BL-001](./BL-001-case-work-area.md) case work area · [BL-003](./BL-003-guardrails-safety.md) guardrails & safety · [SOURCE_LICENCE_ALLOWLIST.md](../SOURCE_LICENCE_ALLOWLIST.md) · [policies/](../policies/)

## Intent

Define the technical architecture for ChatLegal as a set of components, interfaces, and non-goals — enough to estimate build, hosting, and compliance — without implementing yet.


## Components in scope

### 1. Chat platform
- Session model (anonymous → registered; case-bound threads)
- Leaf/protocol selection and guided turns
- Citation UI; GenAI disclosure chrome ([policies/05](../policies/05-genai-disclosure.md))
- Escalation / handoff surfaces

### 2. RAG platform
- Ingest pipeline for **allowlisted** sources only (OGL / licensed FCL after TNA Transactional licence)
- Chunking, jurisdiction tags (`EW` \| `SCT` \| `NIR` \| `UK`), licence + retrieved-date metadata
- Embedding index + live API fallback (legislation.gov.uk, GOV.UK Content API, FCL lookup)
- Citation revalidation / takedown sync jobs
- Hard separation from opt-in user case corpus ([policies/08](../policies/08-privacy-tiers-improvement-data.md))

### 3. Document storage
- User uploads for case work area (BL-001): encrypted at rest, virus scan, retention policy TBD
- Originals vs OCR text; access control per case / tier
- No public RAG of user documents unless future explicit product decision + consent

### 4. Security design
- Threat model (abuse, prompt injection via uploaded docs, data exfiltration)
- AuthN/AuthZ; secrets; UK hosting preference; subprocessors; logging redaction
- `noindex` / discoverability controls for judgment text ([policies/07](../policies/07-data-publication-discoverability.md))
- Alignment with UK GDPR / DPA and TNA licence conditions

### 5. Inference backend
- Model hosting options (managed API vs self-host)
- **BYO key?** — decide whether Pro/team (or all paid) may bring their own provider key; implications for logging, zero-retention contracts, support, and eval parity
- Latency / cost envelopes for Free vs Paid vs Pro
- Tool-calling / MCP boundary if used

### 6. Login & tier / payment processing
- Auth (email magic link / OAuth — TBD)
- Tiers: Free (opt-in improvement data), Paid (opt-out), Pro (usage + team) — [policies/08](../policies/08-privacy-tiers-improvement-data.md)
- Payment provider, tax, refunds, dunning; no dark patterns on consent
- Team admin: usage, seats; cannot force improvement-data opt-in for members

## Out of scope for this item
- Detailed CSE / self-harm / terrorism handling → **[BL-003](./BL-003-guardrails-safety.md)**
- Leaf protocol content and eval gold answers → [EVAL_PACK.md](../EVAL_PACK.md)
- TNA application text → [policies/09](../policies/09-tna-working-practices-answers.md)

## Deliverables (when worked)
1. Architecture one-pager + component diagram (repo `docs/architecture/` or ADR set)
2. Interface contracts between chat ↔ RAG ↔ storage ↔ billing
3. Decision record: BYO key yes/no + rationale
4. Subprocessor shortlist with region and retention terms
5. Rough build phases and dependencies on BL-001 / BL-003 / TNA licence

## Open questions
1. UK-only hosting required at launch?
2. BYO key for Pro only, or never?
4. Single-tenant vs multi-tenant data isolation for Pro teams?
