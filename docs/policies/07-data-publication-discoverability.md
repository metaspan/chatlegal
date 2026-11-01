# 07 · Data publication & discoverability

> **DRAFT · PLAN MODE · for review by qualified counsel · not legal advice.** ChatLegal (chatlegal.uk) · operating entity: [legal entity name · company number]. Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports TNA Q21 (entire record online), Q22 (extracted data published), Q23 (methodology), Q24 (publish findings), MoJ principle 7 (Discoverability: no search-engine indexing of judgment contents).

## Signpost, don't republish
- We do **not** host full judgment bodies as our own pages. Full text = link to the authoritative Find Case Law URL.
- In-product we show short anonymised extracts + neutral citation inside an authenticated session view.

## What we publish
| Item | Published? | Form |
|---|---|---|
| Full judgment text | No | Link to FCL only |
| Neutral citations, court, date, jurisdiction tags | Yes (in answers; limited) | Within answers and help guides |
| Allowlisted source metadata | Yes | Source/licence list on methodology page |
| Bulk judgment text / embeddings / entity lists | No | Never |
| Statistics from judgments | Only if aggregated, anonymised and Ethics-Reviewer approved | Research note with limits stated |
| Methodology | Yes | Public "How ChatLegal works" page |
| Findings / research blogs | Optional | Anonymised aggregates only; no case-level personal data |
| User data | Never public | Aggregated, anonymised product metrics only (k ≥ [10]) |

## Discoverability controls (technical)
1. All pages rendering judgment text or extracts: `<meta name="robots" content="noindex, nofollow, noarchive">` + `X-Robots-Tag: noindex, nofollow, noarchive` header.
2. Judgment extracts served only behind session (no public permalinks to extracts); shared answer links are unguessable, expiring and noindex.
3. robots.txt disallows answer/session/extract paths; block known AI crawlers (GPTBot, CCBot, Google-Extended, etc.) on those paths.
4. Rate limiting, bot detection and no public API/MCP exposing judgment text without contractual flow-down of the same terms.
5. Sitemap includes only marketing, help and methodology pages.
6. Quarterly check: search-engine queries for distinctive judgment phrases + our domain; any hit = incident (02).
7. Any future API/MCP or B2B reuse: licensees must accept noindex, takedown and anonymisation terms.
