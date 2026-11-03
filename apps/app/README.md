# app.chatlegal.uk

Signed-in ChatLegal app for **personal Consumer accounts**, served only at **https://app.chatlegal.uk**.

`https://chatlegal.uk` is [`apps/site`](../site): docs and the waitlist. Clerk is not on that site. Do not add Clerk keys, scripts, or middleware there.

This slice is Clerk sign-in plus the three-pane shell. Matters, case work, and chat are placeholders. There is no model, no retrieval, and no letter drafting.

A 502 on https://app.chatlegal.uk means the app process is not running there yet. This repository change does not deploy it.

**Not a solicitor. Not legal advice.**

## Run

```bash
cd apps/app
cp .env.example .env.local
# Put Clerk keys in .env.local. They are issued out of band and must not be committed.
yarn install
yarn dev
```

Node 22. Yarn 1. The site (`apps/site`) stays a static export; this app is a Next.js server.

## Environment

See [`.env.example`](.env.example).

| Variable | Production value |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_test_` / `pk_live_`). Out of band |
| `CLERK_SECRET_KEY` | Clerk secret key (`sk_test_` / `sk_live_`). Server only. Out of band |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `https://app.chatlegal.uk/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `https://app.chatlegal.uk/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `https://app.chatlegal.uk/` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `https://app.chatlegal.uk/` |
| `NEXT_PUBLIC_CLERK_IS_SATELLITE` | Unset. This app is not a satellite of chatlegal.uk |
| `NEXT_PUBLIC_CLERK_DOMAIN` | Unset. Do not share a cookie domain with chatlegal.uk |
| `NEXT_PUBLIC_CLERK_FAPI` | Optional Frontend API origin. Unset uses Clerk's hosted Frontend API |
| `NEXT_PUBLIC_CLERK_PROXY_URL` | Optional. Only `https://app.chatlegal.uk/__clerk` |
| `NEXT_PUBLIC_CLERK_API_URL` | Optional Backend API origin. Default `https://api.clerk.com` |

The provider also sets `allowedRedirectOrigins` to `https://app.chatlegal.uk`. In the Clerk Dashboard, allowed origins and redirect URLs are that origin only. Do not add `https://chatlegal.uk`.

`assertAppClerkHost()` rejects absolute Clerk redirect env values whose origin is not `https://app.chatlegal.uk` (localhost is allowed for a developer machine). Relative paths stay on whatever host is actually serving this app, which must be app.chatlegal.uk in production.

CI compiles with a non-functional `pk_test_` / `sk_test_` placeholder so the build does not need a live Clerk instance. Those values are not a Clerk application.

## Reverse proxy

No extra env keys. Keep the absolute `NEXT_PUBLIC_CLERK_SIGN_*_URL` values in the table. Do not set `NEXT_PUBLIC_CLERK_IS_SATELLITE`.

Ops runs the server on `127.0.0.1:3011`. Nginx terminates TLS and proxies with:

- `Host: app.chatlegal.uk` (or `X-Forwarded-Host: app.chatlegal.uk`)
- `X-Forwarded-Proto: https`

`proxy.ts` does not rewrite or redirect that request to `localhost`, `127.0.0.1`, or `::1`. `/sign-in` and `/sign-up` render here. Unsigned `/` redirects to `/sign-in` on `https://app.chatlegal.uk`. A `pk_test_` key still cannot finish sign-in. Production `pk_live_` keys do not use Clerk's dev-browser handshake. `https://chatlegal.uk` stays the docs site.

Create the Clerk application with **Organizations turned off**. This repo does not render an organisation switcher, team roles, or a workspace picker.

## What is wired

- `ClerkProvider` in the root layout.
- `proxy.ts` (`clerkMiddleware`) sends unsigned visitors to `/sign-in`. `/sign-in` and `/sign-up` are public.
- Signed-in routes under `app/(app)` call `requireConsumerSession()` and render inside the shell.
- Sign-out returns to `https://app.chatlegal.uk/sign-in`.
- The home page shows the Clerk user id and session id when a session exists.

## Shell

| Pane | Now |
|---|---|
| Left | Matters and Work links, personal account, sign-out, theme |
| Middle | Case-work placeholder, plus a session proof on `/` |
| Right | Chat placeholder. Width drags on desktop and is stored in `localStorage` (`chatlegal.chat.sidebarWidth`) |

## Deferred

- Clerk Organizations, seats, and workspace switching.
- AG-UI chat, widgets, Mastra, TaskRunner, and HITL `ask_user`.
- `hitly-net/hitl-spec@3410eda` schemas are not vendored yet.

Next slices should start from the pins in the pull request, not from a new layout.

## Checks

```bash
yarn test
yarn build
```
