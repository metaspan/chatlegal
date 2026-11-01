# 06 · Dataset limits & accurate representation (esp. Find Case Law)

> **DRAFT · PLAN MODE · for review by qualified counsel · not legal advice.** Metaspan Ltd ([company number]), trading as ChatLegal (chatlegal.uk). Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports TNA Q27 (explain FCL limits = Yes), MoJ principles 3 (Appropriate scrutiny) and 9 (Accurate data representation).

## What we tell users (plain English, on the methodology page and in-product where relevant)
1. **Incomplete collection.** Find Case Law does not hold every judgment. Coverage varies by court and by year; many older judgments, most county-court decisions and some tribunals are missing [confirm current coverage statement with TNA]. Most cases settle and are never judged.
2. **Not a predictor.** The cases we cite illustrate how the law has been applied. They do not show how likely you are to win, and we never estimate that.
3. **Judgments change.** Courts can revise or remove judgments. We use the current published version and remove withdrawn ones.
4. **Jurisdiction.** England & Wales, Scotland and Northern Ireland have different law and procedure. Answers are tagged and we will tell you if your situation is outside England & Wales at launch.
5. **Point in time.** Law changes (e.g. Renters' Rights reforms). Each answer shows source dates; check the linked source.
6. **Anonymised extracts.** Names in extracts are replaced with roles; read the full judgment on Find Case Law.

## Accurate-representation controls
| Control | Rule |
|---|---|
| Version sync | Daily delta check against FCL (Atom feed/API); re-fetch changed docs; store version hash. |
| Takedown | Withdrawn → purge raw, chunks, embeddings, caches, eval fixtures within [24h]; log. |
| Revalidate citations | Nightly job checks each cited URL/version still exists and matches; failing citations suppressed. |
| No statistics from FCL | No "X% of tenants win" claims; any aggregate published must state dataset limits and be approved by Ethics Reviewer. |
| Quoting | Quotes verbatim from current version, with neutral citation and link; no paraphrase presented as quote. |
| Weight | Distinguish binding vs persuasive, appellate vs first instance; flag when a case was overturned/doubted where known [source TBD]. |
| Statute first | Answers lead with legislation and official guidance; case law illustrates. |
