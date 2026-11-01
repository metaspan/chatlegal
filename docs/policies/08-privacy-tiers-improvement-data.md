# 08 · Privacy, tiers & improvement data

> **DRAFT · PLAN MODE · for Legal review · not legal advice.** Metaspan Ltd ([company number]), trading as ChatLegal (chatlegal.uk). Version 0.1 · 1 Nov 2026 · Owner: [Policy owner] · Next review: [date].

Supports MoJ principle 6 (Personal privacy) and the product's tier model. Read with 03.

## Tiers and default data posture
| Tier | Who | Improvement-data default | Can change? |
|---|---|---|---|
| **Free** | Anyone (18+) | **Off until the user opts in.** Clear, separate, unticked consent: "Help improve ChatLegal by letting us use an anonymised copy of your session." | Opt in / withdraw anytime in Settings; withdrawal = treated as opted-out from that point |
| **Paid** | Individual subscriber | **Off (opted out).** | May opt in voluntarily; same withdrawal |
| **Pro / high** | Higher usage + team access | **Off (same as Paid).** | Team admin may *restrict* (lock off for all members). Admin may *enable* opt-in availability, but each member must give their own consent — an admin cannot consent for members. [Legal to confirm] |

Core service quality, safety information and escalation are **identical on every tier**. Free access must never be conditional on opting in (consent must be freely given) — the Free tier's price is ads-free, lower usage limits, not data. [Confirm: no advertising.]

## What "improvement data" means
- Sessions from opted-in users, **anonymised** (03 Part A rules applied to user text: names, addresses, contact details, case numbers, employer names, dates of birth etc. replaced with role tokens; free-text special-category details generalised) before entering:
  - the **opt-in case corpus** (encrypted, separate store, separate keys, restricted access);
  - internal evaluation sets; and
  - [optional] fine-tuning/prompt improvement by Metaspan only.
- Never sold; never shared with third parties except processors under contract; never used by model vendors to train their models.

## Hard rules
1. **Opted-out or withdrawn user text never enters public RAG, any training set, or any shared/published eval corpus.** Enforced by data tagging at write time (`consent_state`) and pipeline filters that fail closed.
2. **Opt-in corpus is separate and encrypted**, never co-mingled with the public-source index (legislation, GOV.UK, FCL).
3. **No user text in public RAG** — even opted-in user text is used only for internal improvement and eval; public retrieval is from allowlisted official sources only.
4. **Withdrawal**: future use stops immediately; already-anonymised records are deleted from the corpus where still linkable [within 30 days]; truly anonymised aggregate statistics cannot be reversed — we say so at consent time.
5. **FCL licence ≠ personal-data agreement.** Nothing in the TNA licence authorises processing user personal data or personal data in judgments; UK GDPR applies independently.
6. **Retention**: session content [e.g. 12 months after last activity, user can delete anytime]; opt-in corpus [e.g. 3 years, reviewed]; logs [90 days]; billing per statutory requirements.

## Consent design
- Separate from terms acceptance; granular (corpus/eval vs model improvement); unticked; plain-English explainer with example of what an anonymised record looks like.
- Records kept: who, when, what wording version, how withdrawn.
- Reminder of current choice shown annually and on tier change. Downgrade Paid → Free does **not** switch opt-in on.

## Paid & Pro consumer terms
- Subscriptions comply with DMCC Act 2024 subscription-contract rules [commencement date to confirm] and Consumer Contracts Regulations 2013 (cancellation rights): clear pre-contract info, easy cancellation, renewal reminders.
- Pro/team: Metaspan is controller for each member's individual use; for team-shared cases, team org may be controller and Metaspan processor — [Legal to decide; DPA template needed].

## Lawful bases (proposed, Legal to confirm)
| Purpose | Art 6 | Art 9 / Sch 1 |
|---|---|---|
| Providing the service (Free) | Legitimate interests / contract | Explicit consent (9(2)(a)) or legal claims (9(2)(f)) |
| Providing the service (Paid/Pro) | Contract | As above |
| Improvement data | Consent | Explicit consent |
| Safety escalation (risk to life) | Vital interests / legitimate interests | 9(2)(c) where applicable |
| Billing | Contract / legal obligation | n/a |

DPIA, Record of Processing Activities, privacy notice and cookie policy (PECR — no non-essential cookies without consent) to be drafted before build.
