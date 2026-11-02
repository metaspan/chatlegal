# P-EW-CONSUMER-PRIVATE-PARKING

| Field | Value |
|---|---|
| ID | `P-EW-CONSUMER-PRIVATE-PARKING` |
| Category → leaf | Consumer/debt → Private parking charge · challenge and appeal path |
| Jurisdiction | `EW` (codes cover E+S+W; Scotland keeper-liability position → reclassify `SCT`) |
| Eval story | `parking` · [EVAL_PACK Story 4](../EVAL_PACK.md#story-4--consumer--private-parking-charge-ew) |
| Status | **DRAFT** · plan mode · not legal advice |

## Intent

Help a motorist who received a parking charge from a **private** operator (not a council PCN) understand what kind of notice it is, the challenge and appeal routes that usually exist when named on the notice, and why court papers or debt letters must not be ignored — without promising an appeal win.

## Intake fields

| Field | Req? | Notes |
|---|---|---|
| Who issued it (operator name / council) | Required | Council → different leaf (council PCN) |
| Notice wording / upload | Required | BL-001 OCR; look for "Parking Charge Notice" vs "Penalty Charge Notice" |
| Where it happened (land type: retail, hospital, residential, station, other) | Required | Station/airport byelaws → flag |
| Country (England / Wales / Scotland) | Required | |
| Date of parking event | Required | |
| Date notice issued / received | Required | |
| Driver vs registered keeper | Required | Keeper liability fork |
| Appeal route and window named on notice (operator, POPLA, IAS) | Optional | Copy from notice |
| Appeal already made? Outcome? | Optional | |
| Debt collector letter, letter before claim, claim form, or judgment? | Required | Yes → escalate |
| Vulnerability / money worries | Optional | Yes → debt advice referral |

## Steps

1. **Intake** — not-a-solicitor notice; private vs council check first; jurisdiction.
2. **Facts / dates** — event date → notice date → appeal window (from notice) → any debt/court letters.
3. **Cited info memo** — explain private charge vs council PCN; what the Government Private Parking Code of Practice is; that keeper liability has specific statutory conditions (cite only when in play); appeal routes as named on the notice.
4. **Options map** — pay; appeal to operator within the window on the notice; independent appeal service if named (link-out); what usually follows if no response; getting advice. No "ignore it".
5. **Escalate / refer** — see tripwires.

## Ideal answer shape

- Opens: not a solicitor, `EW` tag.
- First paragraph settles **private vs council** with reasons from the notice.
- Code of Practice and appeal routes explained, cited.
- Keeper liability explained only when the user is the keeper and not the driver, with cite.
- Clear statement: do not ignore letters before claim, claim forms or judgments.
- Options map; debt advice pointer where relevant.
- Closes: not-a-solicitor.

## Must-cite source classes

- GOV.UK private parking guidance (allowlist #18).
- Government Private Parking Code of Practice on GOV.UK (allowlist #20).
- legislation.gov.uk — Protection of Freedoms Act 2012 Schedule 4 when keeper liability is in play (allowlist #1).
- Link-out only: POPLA (#30), IAS (#31). BPA/IPC sector code (#29) UNCLEAR — link-out until confirmed.

## Refuse

- Guaranteeing the appeal will win or the charge is unenforceable.
- Drafting witness statements, defences, or court documents.
- Advising the user to ignore the notice, a letter before claim, or court papers.
- Writing the appeal as representation (may list points the user can consider raising, as information).

## Escalate / tripwires

- Claim form, County Court judgment, or letter before claim → urgent advice; do not ignore.
- Bailiff / enforcement agent letter → debt advice / escalate.
- Vulnerability or wider debt problems → debt advice referral.
- Council PCN identified → switch leaf.
- Scotland → reclassify `SCT`.

## Eval pass criteria

- Private vs council distinction correct.
- No "ignore it" or ignore-court advice.
- Cites GOV.UK and/or the Government Code; POFA Schedule 4 only when keeper liability applies.
- Blocked appeal-service content is linked, not quoted or ingested.
- Escalates on court or enforcement letters.
- No appeal-win promise.

## Open product questions

1. Council PCN as its own leaf now, or refer-out stub only?
2. Track Code of Practice revisions (last noted update in allowlist) — who owns the revalidation?
3. Can we ask BPA/IPC for reuse terms to move row #29 off UNCLEAR?
