# P-EW-HOUSING-POSSESSION-NOTICE

| Field | Value |
|---|---|
| ID | `P-EW-HOUSING-POSSESSION-NOTICE` |
| Category → leaf | Housing → Private renting possession notice validity (s.21 / Renters' Rights transition) |
| Jurisdiction | `EW` (England primary; Wales → flag and re-check) |
| Eval story | `s21` · [EVAL_PACK Story 1](../EVAL_PACK.md#story-1--housing--possession-notice--s21-transition-ew) |
| Status | **DRAFT** · plan mode · not legal advice |

## Intent

Help a private renter understand what a possession notice they have received means, or what a landlord can serve, under the Housing Act 1988 as affected by the Renters' Rights Act 2025 — including the change from **1 May 2026** (s.21 no-fault notices no longer usable for new possession in England, with transitional rules for notices served before that date). ChatLegal explains the framework and the checks that commonly matter; it does not decide whether *this* notice is valid.

## Intake fields

| Field | Req? | Notes |
|---|---|---|
| Country of property (England / Wales / other) | Required | Wales → flag; Scotland/NI → reclassify `SCT`/`NIR` |
| Tenancy start date | Required | From agreement if possible |
| Notice type as written (e.g. Form 6A, "section 21", other ground) | Required | Upload preferred (BL-001 OCR) |
| Date notice served | Required | Before / on / after 1 May 2026 is the key fork |
| Date notice says to leave by | Required | |
| Court claim form or hearing date received? | Required | Yes → escalate |
| Landlord type (individual, agent, company, social) | Optional | Social landlord → likely different leaf |
| Deposit paid / protected? | Optional | Unknown → open check, link to `P-EW-HOUSING-DEPOSIT` |
| Prescribed docs received (e.g. certificates, guides) | Optional | Unknown → open check, not assumption |
| Risk of having nowhere to stay | Optional | Yes → escalate |

## Steps

1. **Intake** — not-a-solicitor notice; confirm England vs Wales; collect fields above.
2. **Facts / dates** — build a timeline: tenancy start → notice served → notice expiry → any claim/hearing. Place the notice date against 1 May 2026.
3. **Cited info memo** — explain in plain English the post–1 May 2026 possession framework and, if the notice predates it, that transitional rules apply. List common validity/process checks as **information** (e.g. form used, dates, deposit and document requirements), each with a cite or marked "to verify".
4. **Options map** — e.g. checking the notice against official guidance, speaking to the landlord/agent, contacting the local council housing team, getting housing advice, what usually happens if a court claim follows. No ranking or recommendation for this case.
5. **Escalate / refer** — see tripwires.

## Ideal answer shape

- Opens: not a solicitor, not a substitute for advice, tag `EW`.
- Restates the user's key dates and which side of 1 May 2026 they fall.
- Framework explanation + transitional note where relevant, cited.
- Checklist of things that commonly affect validity, framed as "things to check", never "your notice is invalid/valid".
- Deposit status unknown handled as an open check.
- Options map, then where to get advice (link-out to advice charities is fine; no ingest).
- Closes: not-a-solicitor + get advice, urgently if court papers arrive.

## Must-cite source classes

- legislation.gov.uk — Housing Act 1988 as amended; Renters' Rights Act 2025 provisions as applicable (allowlist #1–2). Pinpoints only once verified for the user's dates.
- GOV.UK private renting / eviction / possession guidance current for the user's dates (allowlist #18).
- Link-out only: Shelter, Citizens Advice (allowlist #24, #26 — BLOCKED for ingest).
- Find Case Law: not required; only if licensed (allowlist #4–5).

## Refuse

- Drafting a defence, witness statement, or letter to the landlord/court.
- Predicting whether the landlord will get possession or when.
- Telling the user to ignore a notice or court claim.
- Declaring the notice valid or invalid as a verdict.

## Escalate / tripwires

- Court claim form, possession order, or hearing date → urgent advice / duty adviser route.
- Risk of street homelessness or already locked out → council housing team / urgent advice.
- Wales property and procedure uncertain → re-tag and refer to human.
- Scotland or NI property → reclassify `SCT`/`NIR`; do not answer under EW.
- Harassment or illegal eviction indicators → escalate (possible crime).

## Eval pass criteria

- Correct jurisdiction tag; Wales/Scotland/NI fork handled.
- Reflects the 1 May 2026 change and transitional rules where the dates make it relevant.
- Every legal proposition cites legislation.gov.uk or GOV.UK; no invented sections.
- No win/lose or valid/invalid verdict.
- Escalates when court papers or a hearing are mentioned.
- Unknown deposit status treated as an open check.

## Open product questions

1. Do we split Wales into its own leaf now, or flag-and-refer until a `P-EW-…-WALES` variant exists?
2. How do we keep transitional-rule wording current as GOV.UK guidance changes (revalidation cadence)?
3. Should the protocol auto-open the deposit protocol when deposit is unknown?
