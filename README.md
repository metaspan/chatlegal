# ChatLegal

UK citizen legal information ([chatlegal.uk](https://chatlegal.uk)).

ChatLegal explains everyday problems in plain language and points to official sources. It is information, triage, and cited retrieval. It is not a solicitor, and it is not Citizens Advice.

**Not a solicitor. Not legal advice.**

- Plain-language explanations, with citations to official sources.
- A case type and a protocol, rather than an open-ended chat.
- Money, crime, immigration, children, and hard deadlines are handed on to a person or an official process.

Public docs: [chatlegal.uk/docs](https://chatlegal.uk/docs/). Plan-mode documentation in this repository is [`docs/`](docs/). The site is [`apps/site`](apps/site/) (Next.js static export, Node 22) at [chatlegal.uk](https://chatlegal.uk). [`apps/app`](apps/app/) is the signed-in consumer app at [app.chatlegal.uk](https://app.chatlegal.uk) (personal Clerk accounts and a 3-pane shell). Clerk is not on the docs site. Chat and case work are still placeholders.

## Docs map

| Path | What |
|---|---|
| [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md) | Positioning, case model, sources, open decisions |
| [docs/EVAL_PACK.md](docs/EVAL_PACK.md) | Locked first eval set (5 stories) |
| [docs/SOURCE_LICENCE_ALLOWLIST.md](docs/SOURCE_LICENCE_ALLOWLIST.md) | Source × licence allowlist |
| [docs/protocols/](docs/protocols/) | Draft protocol packs for the five eval leaves |
| [docs/CASE_TAXONOMY.md](docs/CASE_TAXONOMY.md) | Seed Category → leaf list (EW) |
| [docs/eval/](docs/eval/) | Draft gold answer pack for the five eval stories |
| [docs/REFERRALS.md](docs/REFERRALS.md) | Draft referral / escalate destination map |
| [docs/SITE_DOCS_PLAN.md](docs/SITE_DOCS_PLAN.md) | Plan for chatlegal.uk/docs (IA, pipeline, stack, roles) |
| [docs/CURATED_LAWS.md](docs/CURATED_LAWS.md) | Curated laws seed table (five locked leaves) |
| [docs/policies/](docs/policies/) | Draft ethics, privacy, GenAI, TNA answers |
| [docs/backlog/](docs/backlog/) | BL-001 case work area · BL-002 tech design · BL-003 guardrails · BL-004 protocol packs · BL-005 referral map · BL-006 chatlegal.uk/docs site |
| [apps/site/](apps/site/) | chatlegal.uk docs site (static Next.js) |
| [apps/app/](apps/app/) | app.chatlegal.uk consumer shell (Clerk personal accounts; chat not built) |
| [CONTRIBUTORS.md](CONTRIBUTORS.md) | Acknowledgements |

## Licence for this repo

Documentation in this repository is published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) unless a file says otherwise. It is **not** legal advice.
