# BL-005 — Referral / escalate map

**Status:** Draft backlog · plan mode · not for build yet
**Owner:** Product (ChatLegal) · qualified counsel (review of hard-escalate list)
**Depends on:** [BL-003](./BL-003-guardrails-safety.md) safety triggers · [BL-004](./BL-004-protocol-packs-eval-five.md) protocol tripwires
**Related:** [REFERRALS.md](../REFERRALS.md) · [protocols/](../protocols/) · [eval/](../eval/)

## Intent

One maintained map of human destinations, so every protocol's "escalate / refer" step and every BL-003 trigger points to a working, appropriate pathway. Access is like a free advice centre's, with no Citizens Advice / CAB brand claim.

## Scope

1. **Map** — [REFERRALS.md](../REFERRALS.md): categories Housing, Employment, Consumer/debt, Welfare, Cross-cutting, plus a hard-escalate block (crime, immigration, children, domestic abuse, self-harm, imminent homelessness, court hearing within days).
2. **Protocol wiring (when authorised)** — each protocol tripwire references a REFERRALS row ID rather than free-text destinations.
3. **Link hygiene** — every URL fetched and working before release; automated check on a schedule; dead links removed, not guessed.
4. **No ingest** — destinations are link-out only; BLOCKED allowlist sources stay BLOCKED.
5. **Jurisdiction** — Wales / Scotland / NI destinations shown only after re-tag.

## Acceptance

- Every protocol escalate line maps to at least one REFERRALS row.
- Hard-escalate rows reviewed by counsel and aligned with BL-003.
- All URLs return a working page on the review date; access date recorded.
- No third-party branding implies affiliation.

## Link check log (2026-11-03)

Failed or changed during drafting, so **not used** in REFERRALS or gold:

| URL tried | Result | Action |
|---|---|---|
| https://www.gov.uk/housing-loss-prevention-advice-service | 404 | Use https://www.gov.uk/guidance/legal-aid-for-possession-proceedings |
| https://www.gov.uk/challenge-benefit-decision | 404 | Use https://www.gov.uk/mandatory-reconsideration |
| https://www.gov.uk/universal-credit-advances | 404 | Use https://www.gov.uk/universal-credit-advance-hardship-payment |
| https://www.gov.uk/government/publications/universal-credit-hardship-payments | 404 | As above |
| https://www.gov.uk/guidance/renters-rights-act-2025-guide-for-tenants | 404 | Use https://www.gov.uk/guidance/renters-rights-act-overview-for-tenants |
| https://www.gov.uk/government/collections/renters-rights-act-2025 | 404 | Dropped |
| https://www.gov.wales/renting-homes | 404 | Use GOV.WALES possession guidance for contract-holders |
| https://www.acas.org.uk/if-youre-not-paid-correctly | 404 | Use GOV.UK understanding-your-pay |
| https://www.trussell.org.uk/emergency-food/find-a-food-bank | 404 | Use https://www.trussell.org.uk/emergency-food |
| https://www.lawcentres.org.uk/get-help | Timeout | Use https://www.lawcentres.org.uk/ |
| https://www.gov.uk/private-renting/evictions (and other non-existent GOV.UK part slugs) | Redirects to guide start | Use real part slugs only |
| https://solicitors.lawsociety.org.uk/ | 403 to some fetchers; 200 with a browser user agent | Kept; flag for the link checker |

## Open questions

1. Which body (if any) do we approach for formal referral partnerships, and does that change branding rules?
2. Do we show phone numbers in-product (fresher UX) or only link to the destination page (fresher data)?
3. Local-council lookup: postcode → council link at runtime, or the GOV.UK finder only?
