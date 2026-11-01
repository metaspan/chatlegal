# BL-003 — Guardrails & safety

**Status:** Draft backlog · plan mode · not for build yet  
**Owner:** Product + Legal (policy) · Dev (when authorised)  
**Related:** [BL-002](./BL-002-tech-component-design.md) platform · [policies/01](../policies/01-code-of-ethics.md) · [policies/05](../policies/05-genai-disclosure.md)

## Intent

Define how the ChatLegal platform **detects, blocks, escalates, and logs** high-harm categories — separate from general legal-information rails (not a solicitor, cite-or-refuse, jurisdiction tags).

Safety behaviour must be **identical across Free / Paid / Pro** for hard triggers; tier must never weaken refusal or escalation.

## Trigger categories (minimum)

| Category | Examples (non-exhaustive) | Direction of travel |
|---|---|---|
| **CSE** (child sexual exploitation / abuse material) | Any sexual content involving minors; CSAM requests; grooming | Immediate block; no partial answers; no image/OCR continuation that would surface content; preserve evidence-grade logs per Legal; report where law requires |
| **Self-harm / suicide** | Active intent, planning, means | Care-first response; no methods; brief UK crisis pointer (e.g. Samaritans 116 123 / [https://www.samaritans.org](https://www.samaritans.org)); continue only on non-crisis legal topics if safe |
| **Terrorism** | Attack planning, bomb-making, recruitment | Refuse actionable help; no dual-use detail; escalate/log per Legal and UK online-safety duties |

Also track for the same framework (may share classifiers): violent crime planning, weapons manufacture, severe fraud/phishing “how-to”, and jailbreaks that try to strip GenAI disclosure or solicitor disclaimers.

## Platform handling (design goals)

1. **Pre-model filters** on user text and OCR-extracted text (uploads can carry hidden harmful content).
2. **Post-model filters** on assistant output before display.
3. **Fail closed** on classifier error for CSE / terrorism / self-harm planning.
4. **No “helpful” partials** for disallowed categories (no steps, no recipes, no workarounds).
5. **User-visible message** that is calm, short, and non-lecturing; Legal-approved copy.
6. **Audit trail** for triggers (category, hash/redacted snippet policy TBD, model version, action taken) — retention and access under Legal.
7. **Human review path** for false positives on Paid/Pro without exposing blocked content to ops unnecessarily.
8. **Eval set** of adversarial prompts per category; block rate and false-positive rate targets TBD.

## Explicit non-goals
- Replacing emergency services
- Providing clinical therapy
- Automating law-enforcement reports without Legal-defined rules

## Deliverables (when worked)
1. Safety policy addendum (Legal-owned copy + product UX strings)
2. Classifier / filter architecture (owned by BL-002 implementation, specified here)
3. Runbook for on-call / trust & safety
4. Eval suite + release gate (“no ship if CSE/self-harm/terrorism gates regress”)

## Open questions
1. Which vendors vs in-house classifiers; UK data residency?
2. Mandatory reporting thresholds and who is accountable at Metaspan?
3. How OCR pipelines short-circuit when CSE is suspected mid-document?
4. Age gate interaction (18+ proposal in policy open items) with CSE handling?
