# Referral / escalate map

**Status:** DRAFT · for human + qualified counsel check · not legal advice · plan mode
**Related:** [protocols/](protocols/) · [eval/](eval/) · [BL-005](backlog/BL-005-referral-escalate-map.md) · [BL-003 guardrails](backlog/BL-003-guardrails-safety.md) · [SOURCE_LICENCE_ALLOWLIST.md](SOURCE_LICENCE_ALLOWLIST.md)

## Purpose

This is where ChatLegal sends someone when a protocol escalates, or when the user needs a human. It gives access to advice in the way a free advice centre would, by pointing people to free, official and charity services. **ChatLegal is not, and does not claim to be, Citizens Advice or any other advice agency.** Third-party names appear only as link-out destinations; their content is not ingested or quoted (allowlist BLOCKED rows stay BLOCKED).

Every URL below was fetched on **2026-11-03** and returned a working page. Re-check them on the same cadence as the eval gold. Phone numbers are deliberately left out (they change); the destination page holds the current number.

Key: **Official** = government / statutory body · **Charity** = free charity service · **Paid** = usually charged · **Mixed** = free or paid depending on eligibility.

## Hard escalate — stop the product path

If any of these appear, ChatLegal **stops the information flow**, says plainly that this needs a human now, and gives the matching destination. It does not keep answering the underlying legal question. BL-003 safety triggers (self-harm, CSE, terrorism, …) override everything here.

| Trigger | Destination | Public URL | Notes |
|---|---|---|---|
| Crime: immediate danger, violence, threats, illegal eviction in progress | Police (999 if in danger now) · how to contact the police | https://www.gov.uk/contact-police · https://www.police.uk/ | Official. Illegal eviction is a crime per GOV.UK. |
| Crime: victim support | Victim Support | https://www.victimsupport.org.uk/ | Charity. Free. |
| Immigration status / visa / asylum question | Find a regulated immigration adviser (OISC) | https://www.gov.uk/find-an-immigration-adviser | Official finder. Never give immigration information in-product. |
| Children: a child at risk, care proceedings, child arrangements | Report child abuse to a local council · NSPCC · Childline (for children) | https://www.gov.uk/report-child-abuse · https://www.nspcc.org.uk/ · https://www.childline.org.uk/ | Official + charity. Family law is out of scope. |
| Domestic abuse | National Domestic Abuse Helpline | https://www.nationaldahelpline.org.uk/ | Charity. Free. Safety-first wording. |
| Self-harm / suicidal thoughts | Samaritans (999 if in immediate danger) | https://www.samaritans.org/ | Charity. Free. BL-003 care-first handling. |
| Imminent homelessness (tonight / locked out) | Local council homelessness help · find your local council · Shelter emergency helpline | https://www.gov.uk/if-youre-homeless-at-risk-of-homelessness · https://www.gov.uk/find-local-council · https://england.shelter.org.uk/get_help/helpline | Official + charity. England; Wales see Shelter Cymru below. |
| Court hearing tomorrow / within days, or court papers with a deadline | Possession: Housing Loss Prevention Advice Service (on-the-day advice at court) · find a legal aid adviser · find the court | https://www.gov.uk/guidance/legal-aid-for-possession-proceedings · https://find-legal-advice.justice.gov.uk/ · https://www.gov.uk/find-court-tribunal | Official. Free for possession cases per GOV.UK. Other claims: respond by the date on the papers. |

## By category

### Housing

| Destination | When to use | Public URL | Notes |
|---|---|---|---|
| Housing Loss Prevention Advice Service (HLPAS) | Written notice of possession received, possession claim, hearing | https://www.gov.uk/guidance/legal-aid-for-possession-proceedings | Official / legal aid. Free regardless of finances per GOV.UK. Find a provider via the legal aid adviser finder. |
| Find a Legal Aid Adviser or Family Mediator | Locate HLPAS or other legal aid housing providers by postcode | https://find-legal-advice.justice.gov.uk/ | Official (MoJ). |
| Shelter England — get help | Housing advice in England | https://england.shelter.org.uk/get_help | Charity. Free. Link-out only (allowlist #24). |
| Shelter Cymru | Housing advice in Wales | https://sheltercymru.org.uk/ | Charity. Free. Wales → re-tag. |
| Local council housing / homelessness team | Risk of homelessness, repairs, harassment, licensing | https://www.gov.uk/find-local-council | Official. |
| GOV.UK — private renting evictions (England) | Self-help information alongside a referral | https://www.gov.uk/private-renting-evictions | Official. |
| GOV.WALES — possession guidance for contract-holders | Wales property | https://www.gov.wales/understanding-possession-action-process-guidance-tenants-contract-holders-html | Official. |
| Housing Ombudsman Service | Complaints about **social** landlords (not private landlords) | https://www.housing-ombudsman.org.uk/ | Official. Not for private-rented eviction disputes. |

### Employment

| Destination | When to use | Public URL | Notes |
|---|---|---|---|
| Acas — notify / early conciliation | Before any tribunal claim | https://www.acas.org.uk/notify-acas | Official. Free. Time-critical. |
| Acas — contact / helpline | Rights information, how conciliation works | https://www.acas.org.uk/contact | Official. Free. Acas does not give legal advice. |
| GOV.UK — pay and work rights helpline and complaints | NMW and other complaints routed to HMRC / others | https://www.gov.uk/pay-and-work-rights | Official. |
| Equality Advisory and Support Service (EASS) | Discrimination issues | https://www.equalityadvisoryservice.com/ | Government-funded. Free. |
| LawWorks — for individuals | Free legal advice clinics (E&W) | https://www.lawworks.org.uk/find-legal-advice/individuals | Charity. Free. |
| Trade union | Members: legal support | — | Name only; no single URL. |

### Consumer / debt

| Destination | When to use | Public URL | Notes |
|---|---|---|---|
| MoneyHelper | Free, impartial money guidance | https://www.moneyhelper.org.uk/en | Government-backed. Free. |
| StepChange Debt Charity | Debt advice, debt solutions | https://www.stepchange.org/ | Charity. Free. |
| National Debtline | Debt advice (E&W) | https://nationaldebtline.org/ | Charity. Free. |
| GOV.UK — Breathing Space (debt respite) | Debt pressure; protection from creditor action while getting advice | https://www.gov.uk/options-for-dealing-with-your-debts/breathing-space | Official. Accessed via a debt adviser. |
| GOV.UK — respond to a court claim for money | Any money claim form received (e.g. parking, debt) | https://www.gov.uk/respond-to-court-claim-for-money | Official. Deadline-driven, so escalate. |

### Welfare

| Destination | When to use | Public URL | Notes |
|---|---|---|---|
| GOV.UK — mandatory reconsideration | Challenging a DWP decision | https://www.gov.uk/mandatory-reconsideration | Official. |
| GOV.UK — UC advance or hardship payment | No money after a sanction | https://www.gov.uk/universal-credit-advance-hardship-payment/payments-stopped-reduced | Official. Repayable. |
| Turn2us | Benefits checks, grants search | https://www.turn2us.org.uk/ | Charity. Free. |
| GOV.UK — benefits calculators | Check entitlement | https://www.gov.uk/benefits-calculators | Official listing of free calculators. |
| Trussell — get emergency food | No money for food | https://www.trussell.org.uk/emergency-food | Charity. Free (referral-based). |
| Advicelocal | Find local free advice (welfare, debt, housing) | https://advicelocal.uk/ | Free directory (linked from GOV.UK MR page). |

### Cross-cutting

| Destination | When to use | Public URL | Notes |
|---|---|---|---|
| GOV.UK — Find legal advice and information | General "where can I get a lawyer / adviser" | https://www.gov.uk/find-legal-advice | Official. |
| GOV.UK — Check if you can get legal aid | Eligibility for legal aid | https://www.gov.uk/legal-aid/check-legal-aid | Official. |
| Civil Legal Advice (CLA) | Legal aid phone advice: debt where home at risk, housing/homelessness, discrimination, others listed on GOV.UK | https://www.gov.uk/civil-legal-advice | Official / legal aid. Still listed on GOV.UK (2026-11-03). |
| Law Centres Network | Find a local law centre | https://www.lawcentres.org.uk/ | Charity. Free. |
| Citizens Advice | General free advice (listed by public name only; link-out) | https://www.citizensadvice.org.uk/ | Charity. Free. No CAB branding or affiliation claim; content not ingested (allowlist #26). |
| Find a Solicitor — The Law Society | Paid legal advice / representation (E&W) | https://solicitors.lawsociety.org.uk/ | Paid. |
| Find a court or tribunal | Court address / contact for an existing case | https://www.gov.uk/find-court-tribunal | Official. |
| mygov.scot · nidirect | User is in Scotland / Northern Ireland → re-tag `SCT` / `NIR` | https://www.mygov.scot/ · https://www.nidirect.gov.uk/ | Official. |

## Not used / dropped

- Find Case Law: not a referral destination. If ever shown, link-out to the public search page only (https://caselaw.nationalarchives.gov.uk/search), with no bulk/RAG claim, pending the TNA licence.
- URLs that failed fetch on 2026-11-03 are left out (see BL-005).

## Open items

1. Counsel / product: confirm the hard-escalate list matches BL-003 and every protocol's tripwires.
2. Wales and Scotland/NI destination sets beyond the generic links above.
3. Revalidation cadence and an automated link checker before build.
