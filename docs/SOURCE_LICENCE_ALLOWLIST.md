# ChatLegal — source licence allowlist (chatlegal.uk · Metaspan Ltd)

Status: PLAN MODE research only, no build. Researched 1 Nov 2026 (Europe/London) from official licence, terms and copyright pages. Not legal advice. Re-check every licence before build.

Status key: ALLOW · ALLOW_WITH_CONDITIONS (AWC) · APPLY_FIRST · BLOCKED (no ingest/scrape; link-out only, or permission needed) · UNCLEAR (no clear reuse terms found; ask the owner).
A status applies to the **Use** column. Jdx: EW, SCT, NIR, UK.

Counts (34 sources): ALLOW 0 · AWC 16 · APPLY_FIRST 1 · BLOCKED 11 · UNCLEAR 6

## Build blockers (top 5)
1. **Find Case Law computational-analysis licence (APPLY_FIRST).** The Open Justice Licence v2.0 excludes "computational analysis … (including indexing by search engines)". TNA's own list of examples includes "building services or products using AI or LLMs" and "building vector databases for semantic search". Any judgment RAG, embedding or LLM processing needs a Transactional licence first. It is free, typically lasts up to 5 years, and needs Discovery Board sign-off (monthly). Risk: TNA treats "directly inform or influence the decision of a third-party regarding whether to pursue justice or legal action" as **high risk**, and ChatLegal triage is close to that.
2. **BAILII (BLOCKED).** The terms prohibit "incorporating search results or HTML versions of judgments into … the output of a computer program", storing them, unauthorised robots and bulk download. There is no API, and the site sits behind an Anubis anti-AI-scraper wall. Use it only for human link-out. Get NI judgments from judiciaryni.uk instead.
3. **Judicial College Guidelines (BLOCKED).** © Judicial College and published by OUP, "All rights reserved. No part … may be reproduced, stored in a retrieval system". The only route is a paid permission (OUP Rights / PLSclear). Until then, PI quantum is link-out and "see a solicitor" only.
4. **Official Injury Claim (BLOCKED).** OICL terms say "domestic and private use", allow no commercial use or storage without a licence, and even say "You may not establish … a link to this Website … without obtaining OICL's prior written consent". Use the Whiplash Injury Regulations 2021 tariff and CPR on legislation.gov.uk (OGL) instead. Check the SI reference before build.
5. **Advice-charity and ADR content (BLOCKED).** Shelter (E and Scot), Citizens Advice, Advicenow, Housing Rights NI and the Financial Ombudsman all limit reuse to personal or non-commercial use or forbid storage in a retrieval system. We can't put their content in the RAG index. We write our own explainers from OGL primary and GOV.UK sources and link out to them.

Also watch:
- The OGL **excludes personal data**, so tribunal decisions (ET, UT AAC) and SCTS/NI judgments still need a UK GDPR lawful basis.
- The OJL bans search-engine indexing of judgment text. Set `noindex` on any page that shows judgment text.

## Table
| # | Source | Jdx | Use | Licence | Commercial | Bulk/RAG | Attribution | Status | Notes / URL |
|---|---|---|---|---|---|---|---|---|---|
| 1 | legislation.gov.uk API (Acts, SIs, SSIs, NISRs) | UK/EW/SCT/NIR | Ingest + cache; live lookup | OGL v3.0 | Yes | Yes (Fair Use Policy) | "© Crown and database right. Derived from content available under the Open Government Licence v3.0 from legislation.gov.uk." EU-origin content also needs Commission Decision 2011/833/EU credit; Westlaw-contributed content needs "Westlaw UK derived from Crown Copyright material and contributed to legislation.gov.uk" | AWC | Limits: ≤3,000 req per 5 min per user, identified User-Agent with contact, robots.txt; use feeds for large crawls. Tag by extent (E+W, S, NI). https://legislation.github.io/data-documentation/reuse-licence.html · https://legislation.github.io/data-documentation/fair-use.html |
| 2 | legislation.gov.uk Publication Log + New Legislation Atom feeds | UK | Daily delta | OGL v3.0 | Yes | Yes | As #1 | AWC | TNA recommends these feeds for delta and bulk instead of crawling. https://www.legislation.gov.uk/new/data.feed |
| 3 | Legislation Research site bulk downloads | UK | Bulk seed | OGL (assumed) | ? | ? | As #1 | UNCLEAR | FOI CAS-241528 (Mar 2025) says pre-packaged bulk downloads were in pre-release, access "may be given upon request". Ask legislation@nationalarchives.gov.uk. https://www.nationalarchives.gov.uk/freedom-of-information/requests/cas-241528/ |
| 4 | Find Case Law: live API lookup, display, quote, link to single judgments | EW + UK courts/tribunals | Live search + link + quote | Open Justice Licence v2.0 | Yes | No (see #5) | "Contains information licensed under the Open Justice Licence v2.0." + link to the licence | AWC | Use the current version; remove judgments that are taken down or revised; obey anonymity and reporting orders; no endorsement; respect the dignity of the courts; no search-engine indexing; API limit 1,000 req per 5 min per IP. https://caselaw.nationalarchives.gov.uk/open-justice-licence · https://nationalarchives.github.io/ds-find-caselaw-docs/public |
| 5 | Find Case Law: bulk index / embeddings / RAG / LLM processing | EW + UK | Ingest / RAG | Transactional (computational analysis) licence | Yes, once licensed | Only with licence | OJL statement + licence terms | APPLY_FIRST | Free; 29-question form in one sitting; Five Safes + MoJ 9 principles; Discovery Board monthly; "a few weeks"; parts may be published. https://caselaw.nationalarchives.gov.uk/when-you-need-permission · https://caselaw.nationalarchives.gov.uk/licence-application-process · https://caselaw.nationalarchives.gov.uk/what-you-need-to-apply-for-a-licence · https://caselaw.nationalarchives.gov.uk/apply-for-a-licence |
| 6 | UK Supreme Court site (judgments, press summaries) | UK | Link + quote only | OGL for Crown copyright material; video under Open Supreme Court Licence | Yes | Route via #5 | Crown copyright + source | AWC | No framing. Don't bulk-ingest from here; UKSC judgments are also on FCL, so ask TNA whether the OJL/transactional licence governs. https://www.supremecourt.uk/about/terms-and-conditions |
| 7 | judiciary.uk (E&W guidance, practice guidance, sentencing remarks) | EW | Ingest guidance docs | OGL ("unless otherwise indicated") | Yes | Yes (guidance) | Acknowledge Crown copyright + title of source document | AWC | Take judgment text from FCL (#4/#5), not here. https://www.judiciary.uk/copyright/ |
| 8 | GOV.UK Employment Tribunal decisions finder | EW + SCT | Link/cite now; bulk TBC | GOV.UK OGL (personal data excluded) | Yes | UNCLEAR | OGL statement | UNCLEAR | Decisions name parties, which the OGL excludes; UK GDPR basis needed; possible overlap with TNA policy. Ask TNA/DBT. https://www.gov.uk/employment-tribunal-decisions |
| 9 | GOV.UK Administrative Appeals (UT AAC) decisions: benefits | UK/GB | Link/cite now; bulk TBC | GOV.UK OGL (personal data excluded) | Yes | UNCLEAR | OGL statement | UNCLEAR | Many newer UT decisions are also on FCL under OJL. https://www.gov.uk/administrative-appeals-tribunal-decisions |
| 10 | SCTS judgments (official RSS + PDFs; search endpoint) | SCT | Ingest + cache; live search | OGL via SCTS Crown copyright policy (excl. logos/photos) | Yes | Yes (OGL); personal data excluded | Acknowledge source + OGL | AWC | RSS: https://www.scotcourts.gov.uk/rss-feeds/. The JSON search endpoint (api.pa.web.scotcourts.gov.uk) is documented only by third parties, so confirm with enquiries@scotcourts.gov.uk before bulk use. Never mix Scots procedure into EW answers. https://www.scotcourts.gov.uk/scts-crown-copyright-policy/ |
| 11 | Judiciary NI judgments (judiciaryni.uk) | NIR | Ingest + cache | OGL | Yes | Yes (OGL); personal data excluded | Acknowledge Crown copyright + give title of source document | AWC | No logos. Replaces BAILII NI. https://www.judiciaryni.uk/crown-copyright |
| 12 | BAILII (incl. NI + gap-fill) | All | Link-out only (human-chosen URL) | BAILII Terms of Service | Copy/distribute with source credit, but no program use | No | "BAILII" as source | BLOCKED | Prohibits incorporating into program output, storing, unauthorised robots and bulk; no API; Anubis anti-AI wall; whole domains blocked. https://www.bailii.org/bailii/copyright.html · https://www.bailii.org/bailii/faq.html |
| 13 | Civil Procedure Rules (SI 1998/3132) text | EW | Ingest | OGL v3.0 (via legislation.gov.uk) | Yes | Yes | As #1 | AWC | https://www.legislation.gov.uk/uksi/1998/3132/contents/made |
| 14 | CPR Practice Directions + Pre-Action Protocols (justice.gov.uk) | EW | Link now; ingest TBC | Not stated on page (links to TNA Crown copyright guidance; /copyright 404) | ? | ? | Crown copyright (assumed) | UNCLEAR | Probably Crown copyright under OGL, but no statement found. Confirm with MoJ before ingest. https://www.justice.gov.uk/courts/procedure-rules/civil |
| 15 | Judicial College Guidelines (PI general damages) | EW | Link-out / refer only | © Judicial College; published by OUP; all rights reserved | No | No | n/a | BLOCKED | Permission route: OUP Rights Dept / PLSclear (likely fee). The 17th edn (2024) PDF copies say "Reproduced with permission of the Licensor through PLSclear". |
| 16 | Official Injury Claim website + MI data | EW | None (no linking without consent) | OICL Terms of Use | No | No | n/a | BLOCKED | "domestic and private use"; no storage or commercial use without licence; linking requires consent. Alternative: Whiplash Injury Regs 2021 + CPR Part 27 / PD 27B on legislation.gov.uk / justice.gov.uk. https://www.officialinjuryclaim.org.uk/terms-of-use/ |
| 17 | Acas guidance + Codes of Practice | GB (EW+SCT) | Ingest + cache | OGL "except where otherwise stated" | Yes | Yes | Source + OGL | AWC | No framing; no implied endorsement; third-party material excluded. https://www.acas.org.uk/copyright |
| 18 | GOV.UK guidance via Content API (housing, private renting, employment, benefits, UC sanctions, MR, parking) | UK (page-level) | Ingest + cache; live | OGL v3.0 | Yes | Yes | "Contains public sector information licensed under the Open Government Licence v3.0." | AWC | Content API 10 req/s, no key; robots.txt; logos/Royal Arms/third-party content excluded; tag each page with its jurisdiction. https://www.gov.uk/help/reuse-govuk-content · https://content-api.publishing.service.gov.uk/ · https://www.gov.uk/help/terms-conditions |
| 19 | GOV.UK Search API | UK | Discovery / live search | OGL v3.0 | Yes | Yes | As #18 | AWC | GOV.UK labels it "unsupported" and says it "may change without notice". https://www.gov.uk/api/search.json |
| 20 | Government Private Parking Code of Practice (GOV.UK, updated 20 Oct 2026) | E+S+W | Ingest | OGL v3.0 | Yes | Yes | As #18 | AWC | Statutory code; use it in place of the BPA/IPC sector code. https://www.gov.uk/government/publications/private-parking-code-of-practice |
| 21 | gov.scot (Scottish Government) | SCT | Ingest + cache | OGL (excl. logos; some Flickr/YouTube media NC) | Yes | Yes | Source + OGL | AWC | https://www.gov.scot/crown-copyright/ |
| 22 | mygov.scot | SCT | Ingest + cache | OGL v3.0 (site footer: "Open Government Licence v3.0 · © Crown Copyright") | Yes | Yes | Source + OGL | AWC | No standalone copyright page found (404). Status is based on the footer only. https://www.mygov.scot/ |
| 23 | nidirect | NIR | Ingest + cache | OGL (excl. logos, OSNI mapping) | Yes | Yes | Source + OGL | AWC | https://www.nidirect.gov.uk/articles/crown-copyright |
| 24 | Shelter England + Shelter Legal | EW | Link-out only | Shelter terms | No | No | n/a | BLOCKED | "personal, non-commercial use … may not copy, reproduce, republish". https://england.shelter.org.uk/contact_us/legal_disclaimer_and_copyright |
| 25 | Shelter Scotland | SCT | Link-out only | Shelter terms | No | No | n/a | BLOCKED | Same wording. https://scotland.shelter.org.uk/about_us/about_this_website/legal_disclaimer_and_copyright |
| 26 | Citizens Advice (all nations) | UK | Link-out only | CA terms | No | No | n/a | BLOCKED | Any other use needs written permission. Also: no CAB branding. https://www.citizensadvice.org.uk/about-us/information/terms-and-conditions/ |
| 27 | Advicenow (Law for Life) | EW | Link-out only | Advicenow terms | No | No | n/a | BLOCKED | Any other reproduction or republication "strictly prohibited". https://www.advicenow.org.uk/terms-and-conditions |
| 28 | Housing Rights (NI) | NIR | Link-out only | Housing Rights terms | No | No | n/a | BLOCKED | https://www.housingrights.org.uk/legal-disclaimer-and-copyright |
| 29 | BPA/IPC Private Parking Sector Single Code of Practice | E+S+W | Link-out only | No reuse licence found (BPA/IPC copyright) | ? | ? | n/a | UNCLEAR | Ask BPA/IPC; use #20 instead. https://www.britishparking.co.uk/code-of-practice-and-compliance-monitoring · https://www.theipc.info/publications |
| 30 | POPLA | E+W (private land) | Link-out only | POPLA/BPA copyright statement | Personal use only | No | Credit POPLA + URL | BLOCKED | Other uses need permission: copyrightqueries@flexibleresolutionservices.co.uk. https://www.popla.co.uk/copyright |
| 31 | IAS (Independent Appeals Service) | E+S+W | Link-out only | "All Rights Reserved" (no reuse terms found) | No | No | n/a | BLOCKED | https://theias.org/ |
| 32 | Financial Ombudsman decisions | UK | Link-out only | FOS legal policy | No | No | n/a | BLOCKED | "must not … store any part of this site in any … electronic retrieval system, without our prior permission". https://www.financial-ombudsman.org.uk/legal-policy |
| 33 | Housing Ombudsman decisions | E | Link-out now | © Housing Ombudsman Service; no reuse terms found | ? | ? | n/a | UNCLEAR | https://www.housing-ombudsman.org.uk/decisions/ |
| 34 | ChatLegal user case corpus (opt-in) | n/a | Private store; future case-management/eval | UK GDPR / DPA 2018 (not a content licence) | n/a | Opt-in only; never public RAG | n/a | AWC | Kept separate and encrypted, with explicit opt-in and withdrawal. Opted-out user text never goes into the public RAG, eval or training data. The TNA licence "is not a data sharing agreement". |

## TNA computational-analysis licence: next steps
- **Found:** yes. https://caselaw.nationalarchives.gov.uk/apply-for-a-licence (form). Prep: /what-you-need-to-apply-for-a-licence. Process: /licence-application-process. Contact: caselawlicence@nationalarchives.gov.uk.
- **What it asks for (29 questions, 6 sections, one sitting, no saving):**
  1. Contact and a senior licence holder.
  2. Organisation: Metaspan Ltd legal name, company number, partners. May be published.
  3. Purpose: product name, link (chatlegal.uk), main purpose and access type, in 150 words or fewer.
  4. Public statement of 150 words or fewer.
  5. Working practices: anonymise individuals?, bias review, code of ethics, impartial ethics review, publish full record or extracted data?, methodology transparency, high-risk uses, GenAI disclosure to users, explain FCL dataset limits.
  6. A statement covering each of the 9 MoJ principles (dignity, independence, appropriate scrutiny, anti-discriminatory harm, anti-bias, privacy, discoverability (no search-engine indexing), algorithmic transparency, accurate data representation), plus accepting them as licence terms.
- **Assessment:** Five Safes + 9 principles. The team decides whether the use is high risk. Two licence types: R&D (about 1 year) or Transactional (up to 5 years, commercial and not high risk). Discovery Board meets monthly; a few cases go to the Senior Data Governance Panel (quarterly). No fee. Decision in "a few weeks".
- **Our next steps (plan only):**
  1. Write the 150-word purpose and public statement framed as information/triage that cites sources and does not produce automated legal advice or outcome prediction. Q25 = "None of the above" only if that is true.
  2. Decide whether to anonymise names before embedding.
  3. Name an ethics reviewer.
  4. Design takedown sync, i.e. re-check the current version.
  5. Set `noindex` on judgment text.
  6. Write a GenAI disclosure.
  7. Have qualified counsel review the draft.
  8. Consider asking caselawlicence@ first about the triage high-risk question.
- **Inconsistency to resolve:** the "Using Find Case Law records" page says a licence is needed for "incorporating large numbers of judgments into commercial products". Other TNA pages say incorporating judgments into products is free and only computational analysis needs a licence. Ask TNA.

## OGL-safe pattern
1. Ingest only OGL/OJL-licensed text from official hosts. Store source URL, licence, version/retrieved date and jurisdiction tag on every chunk.
2. Show the licence attribution in the product (footer plus a per-answer source list). Use the legislation.gov.uk wording for statute.
3. Leave out logos, Royal Arms, crests, OSNI mapping, third-party-credited material and personal data, and never imply government or court endorsement.
4. Respect rate limits and robots.txt, send an identified User-Agent, and prefer feeds and APIs to crawling.
5. Linking vs quoting vs indexing:
   - Linking is fine everywhere except OIC (needs consent).
   - Quoting OGL/OJL text is fine with attribution.
   - Indexing/RAG is fine for OGL. For FCL it needs the transactional licence. BAILII and private or charity sources are not allowed.
6. Re-validate citations daily and drop withdrawn or revised judgments.
7. User case corpus stays separate (see #34).

## Excluded from RAG (link-out or none)
BAILII · JCG (OUP) · OIC · Shelter (E/Scot) · Citizens Advice · Advicenow · Housing Rights NI · POPLA · IAS · FOS decisions. Unclear until confirmed: BPA/IPC code, Housing Ombudsman, CPR PDs on justice.gov.uk, ET and UT AAC decision bulk use, Legislation Research bulk.
