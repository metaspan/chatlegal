# ChatLegal — project brief

**Product:** chatlegal.uk · **Entity:** Metaspan Ltd (unless a separate vehicle is formed)  
**Status:** Plan mode — design and licensing only until build is authorised.  
**Audience:** Public product documentation. Not legal advice.

## What it is

ChatLegal is a free or affordable UK citizen **legal-information** service. Users create a case or question session, describe their situation, and receive plain-English explanations of relevant law, key dates, and options, with citations to official sources. The product shape is: public register → create session → ask questions.

It is **information + triage + cited retrieval**, not an “AI solicitor,” not representation, and not reserved legal activities. It is inspired by access-to-justice models (CAB-style), but is **not** Citizens Advice and must not use CAB branding.

## Design principles

- Do not train a model on proprietary “UK law” as a substitute for sources; retrieve and cite; gather an **opt-in** case corpus for later case-management features.
- First quality bar: a small set of public scenarios with questions and **human-checked** answers (see [EVAL_PACK.md](./EVAL_PACK.md)).
- Unauthorised persons may give general legal information in England & Wales; reserved activities and holding out as a solicitor are hard stops.
- Not a substitute for a solicitor; no court filings; no “you will win”; cite Find Case Law / legislation.gov.uk only when verified; escalate to humans for money/crime/immigration/children/hard deadlines.
- GDPR: clear opt-in/out for improvement and case-corpus use; encrypt user case data; never put opted-out user text in public training or RAG.

## Related work and positioning

[openjustice.ai](https://openjustice.ai) (Queen’s Conflict Analytics Lab) is an established B2B product focused on reasoning protocols, a large judgment library, and API/MCP deployment without a fine-tuning pitch. ChatLegal is **influenced by** that emphasis on protocols over freeform chat, evaluation against ideal answers, cite-checkable outputs, and API/MCP-ready deploy — while aiming at a different wedge: **UK citizen intake**, sources tagged for England & Wales / Scotland / Northern Ireland, Find Case Law under the Open Justice Licence (with a separate TNA licence before bulk computational analysis), and an opt-in user case corpus.

## Naming

Avoid CAB / Citizens Advice. Prefer information / cases / cite over solicitor / counsel.  
**Favoured domain:** chatlegal.uk · **Spare:** chatlaw.uk · Public brand name still TBD.

Earlier shortlist for reference: PlainLaw, CaseChat, CiteUK, PublicCase, LawTriage; Metaspan-family CaseSpan / CiteSpan / LawSpan.

## Case model

**Category → case type (leaf) → protocol.**  
The session picks a leaf; the protocol derives key dates and an activity checklist.

**Categories (v0):** Housing; Employment; Personal injury; Consumer/debt; Family; Welfare/benefits; Immigration (signpost); Crime (info only); Other/unclear (triage → reclassify).

**Every leaf emits:** key dates + activities (intake → documents → cited information memo → options map → escalate/refer · optional GDPR opt-in).

Planned **case work area** (discovery questionnaire, document OCR/entity extraction, timeline, gap tasks): [backlog/BL-001-case-work-area.md](./backlog/BL-001-case-work-area.md).

## Example user stories

- **Housing:** mould, deposit, possession notices (incl. post–May 2026 Renters’ Rights transition), noise, boundary/fence, right of way.
- **Employment:** unfair dismissal after sick leave, unpaid wages, harassment, redundancy.
- **Personal injury:** trip/slip, RTA / Official Injury Claim pathway (link policy constrained), work injury, dog bite.
- **Consumer/debt:** private or council parking charge, faulty goods, bailiffs, mis-sold credit.
- **Family:** split finances, children contact, domestic abuse → urgent escalate.
- **Welfare:** UC sanction, PIP refusal, mandatory reconsideration / tribunal clock.
- **Immigration / crime:** signpost / information only.
- **Other:** “letter from court — what is this?”

## Sources / retrieval (summary)

Tag every chunk `EW` | `SCT` | `NIR` | `UK`. Never mix Scots or NI procedure into E&W answers.

- **Primary:** legislation.gov.uk (OGL); Find Case Law (Open Justice Licence; **Transactional computational-analysis licence required** before bulk RAG); SCTS; Judiciary NI.
- **Soft law / guidance:** CPR (and PDs when licence confirmed), Acas, GOV.UK, ScotGov / mygov.scot, nidirect. Judicial College Guidelines and Official Injury Claim site are **not** for ingest (see allowlist).
- **Architecture (planned):** object store → normalize → chunk/embed cache → live API fallback; jobs for ingest-delta, RSS top-up, citation revalidation, licence audit.
- **Detail:** [SOURCE_LICENCE_ALLOWLIST.md](./SOURCE_LICENCE_ALLOWLIST.md).

## Plan slices (status)

1. ~~Eval set: 5 stories + acceptance criteria~~ — locked; see [EVAL_PACK.md](./EVAL_PACK.md)
2. ~~Source licence research~~ — see allowlist
3. ~~Domain~~ — chatlegal.uk favoured
4. Draft policies for TNA / ethics / tiers — see [policies/](./policies/)
5. TNA computational-analysis licence application (after Legal sign-off on open items)

## Contributors

See [CONTRIBUTORS.md](../CONTRIBUTORS.md).
