# apps/site — chatlegal.uk docs

Public docs and marketing shell for [chatlegal.uk](https://chatlegal.uk). Hermes M1 of [BL-006](../../docs/backlog/BL-006-chatlegal-uk-docs-site.md). Information architecture follows [SITE_DOCS_PLAN.md](../../docs/SITE_DOCS_PLAN.md) §B.

**Not a solicitor. Not legal advice.**

This app is custom Next.js (App Router) and MDX. It does not use Fumadocs or Nextra. There is no chat UI. `apps/app` is the reserved placeholder for `app.chatlegal.uk`.

## Node

Build with **Node.js 22 LTS** (see `.nvmrc` and `engines`). Yarn 1 installs dependencies. Production hosting does not run Node.

```bash
cd apps/site
nvm use
yarn install
yarn build
```

`yarn build` writes a static site to `apps/site/out/` because `next.config.ts` sets `output: 'export'`. Do not use `next start` for production. That command expects a Node server, and this app does not ship one.

## What Ops deploys

Copy the contents of `out/` to the nginx docroot. No database and no Node process on the VM.

| | |
|---|---|
| Host | Proxmox VM `chatlegal`, `192.168.10.34` |
| Docroot | `/var/www/chatlegal` |
| URL | http://192.168.10.34:3000 |
| Artifact | `apps/site/out/` (rsync the directory contents onto the docroot) |

`trailingSlash: true`, so each route is a directory with `index.html` (for example `out/docs/housing/deposit/index.html`). A static server can use:

```nginx
server {
    listen 3000;
    server_name chatlegal.uk 192.168.10.34;
    root /var/www/chatlegal;
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

`/` is the marketing landing, not a redirect. `/docs/` is the documentation. TLS, DNS, and the rsync itself are separate from this app. The static files do not include a server.

Preview the export locally with `yarn preview` (port 4173) after a build.

## Content

Page copy is MDX under `app/docs/`. The sidebar list is `lib/nav.ts` (37 pages: overview, how it works, four law hubs with locked leaves then planned stubs, sources and its subpages, referrals, policies, for agents).

The build reads the sibling repository `docs/` directory. It does not fetch content and it does not use a submodule. `scripts/assert-docs-root.ts` checks that `docs/SITE_DOCS_PLAN.md` and the related source files are present. The docs layout reads the plan file again while pages are rendered. Curated-law and allowlist **tables are not generated** here. That is Hermes M2. These pages are short placeholders. None of them carry a counsel “reviewed” badge.

`/llms.txt` is a stub index written from `lib/nav.ts` at build time into `public/llms.txt`, then copied to `out/llms.txt`.

## Routes

`/` is the landing page, with a beta waitlist form. Everything else in the public tree is under `/docs/` and matches the plan’s URL tree, including:

- `/docs/housing/possession-notice/` and `/docs/housing/deposit/` (eval set, still placeholders)
- `/docs/housing/illegal-eviction/` (planned, hard-escalate callout)
- `/docs/employment/unpaid-wages/`
- `/docs/consumer/private-parking/`
- `/docs/welfare/uc-sanction-mr/`
- `/docs/sources/` and `/docs/sources/legislation/`, `govuk-acas`, `find-case-law`, `courts-tribunals`, `link-out-only`, `attribution`
- `/docs/referrals/`, `/docs/policies/`, `/docs/for-agents/`

Find a page in the sidebar searches titles. It is not a chat box.

## Beta waitlist

The form on `/` posts JSON to the same origin, `POST /api/waitlist`. It does not call the webhook from the browser. A direct browser call would send `Authorization`, which is not a CORS-safelisted header, so a typical webhook fails the preflight. The static export has no API route. Until something answers `/api/waitlist`, the form shows that signups are not being accepted.

`apps/site/ops/waitlist-proxy.mjs` is a small Node 22 process that can sit beside nginx. It is not copied into `out/`.

Request body:

```json
{ "email": "", "name": "", "note": "", "source": "chatlegal.uk", "recaptchaToken": "" }
```

The proxy checks reCAPTCHA v3 with `RECAPTCHA_SECRET_KEY` (`action` `waitlist`, score at least 0.5). It then POSTs `{ "email", "name", "note", "source": "chatlegal.uk" }` to `CHATLEGAL_WAITLIST_WEBHOOK_URL`, with `CHATLEGAL_WAITLIST_WEBHOOK_HEADER` as the `Authorization` value when that variable is set. The token and the secret are not forwarded. If `company` or `website` is non-empty, the proxy returns success and does not call Google or the webhook. The form also drops those honeypot values in the browser and does not send them.

Responses: `200` `{ "ok": true }`, `400` `{ "ok": false, "error": "captcha" }` or `"email"`, `502` `"webhook"`, `503` `"unconfigured"`.

Build-time public env is only `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (see `.env.example`). Leave it blank and the form stays disabled: “Waitlist opening soon.” The webhook URL and both secrets are server env on the proxy, not `NEXT_PUBLIC_*`.

```nginx
location = /api/waitlist {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Run the proxy with Node 22 from `apps/site`, bound to localhost, and keep the rest of the server as the static `out/` docroot. Do not put the proxy env in the static build.
