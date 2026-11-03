# app.chatlegal.uk

Signed-in ChatLegal app for **personal Consumer accounts**, served only at **https://app.chatlegal.uk**.

`https://chatlegal.uk` is [`apps/site`](../site): docs and the waitlist. Clerk is not on that site. Do not add Clerk keys, scripts, or middleware there.

This slice is Clerk sign-in, the three-pane shell, matter history, a file library, and a centre-pane chat. One matter is one Mastra chat thread, stored for the signed-in Clerk user. The library and each matter also have their own Mastra workspace. Send saves what you write on the open matter. A reply is not written yet. There is no retrieval and no letter drafting.

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
| `CHATLEGAL_MATTERS_DB` | Optional. Default is a local libSQL file, `data/matters.db`, in the app working directory. On the host set `file:/var/lib/chatlegal/matters.db` so a new release does not wipe matters. A `libsql://` URL is the remote move |
| `CHATLEGAL_MATTERS_AUTH_TOKEN` | Optional. Only for a remote libSQL URL. Leave unset for the local file |
| `CHATLEGAL_OM_ENABLED` | Optional. The word `true` turns on observational memory. Anything else, including unset, leaves it off |
| `CHATLEGAL_OM_MODEL` | Required when observational memory is on. A Mastra model id such as `openai/gpt-4.1-mini`. If this is empty, observational memory stays off. Mastra's Gemini default is not used |
| `CHATLEGAL_WORKSPACE_ROOT` | Optional. Directory for Mastra Workspace files (`LocalFilesystem`). Default is `data/workspace` in the app working directory. On the host set `/var/lib/chatlegal/workspace` (or `file:/var/lib/chatlegal/workspace`) so a new release does not wipe the library. This is not the matters LibSQL file. A `libsql://` URL is refused |

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
- `GET /api/matters` and `POST /api/matters` use that same Clerk user id. A matter id from someone else is not returned.
- Sign-out returns to `https://app.chatlegal.uk/sign-in`.
- The home page shows the Clerk user id and session id when a session exists.
- New chat creates a matter thread in Mastra memory (`@mastra/core` 1.78.0, `@mastra/memory` 1.36.0, `@mastra/libsql` 1.26.2). The left pane lists those threads. Opening a row loads that thread into the centre. The composer draft stays in client state under the open matter id. Send appends that text to the thread (`POST /api/matters/:id/messages`, scoped to `clerk:<userId>`). The message shows at once, then the stored row replaces it.
- Each matter can keep a summary in Mastra observational memory, scoped to that thread (`clerk:<userId>` plus the matter id). The centre column shows that summary when one exists. The right pane shows it as chat state until a library file is opened. Another matter's summary is not loaded. The observer model stays off unless `CHATLEGAL_OM_ENABLED` is `true` and `CHATLEGAL_OM_MODEL` is set, so opening a matter does not call a model.
- Library is a link in the left pane. It opens `/library`, the signed-in user's Mastra workspace (`LocalFilesystem`, tools off, no sandbox). That page lists the user's files and can add one (`GET` and `POST /api/library`). The open matter still has its own workspace. A file can move from the library into that matter and back (`POST /api/workspace/move`); the move control is not in the left pane. Another person's matter is 404. There is no agent yet, so Send does not ask a model to reply. Embeddings and search stay off.

## Shell

Signed-in pages use three panes. The left and right panes can be hidden from the top bar, from the pane header, or from the chevron on that pane's edge. A hidden pane leaves a slim rail with the same chevron, and the centre column takes the freed width. That choice is stored in `localStorage` (`chatlegal.shell.leftOpen`, `chatlegal.shell.rightOpen`). On a wide screen, Escape shows chats again when both panes are hidden. The right pane width still drags (`chatlegal.chat.sidebarWidth`).

Colour is the docs-site M1 palette, in `app/globals.css`. Shadcn names point at those tokens. Cream is the page, raised cream is the side panes and cards, ink and muted ink are the type, teal is for links, and burgundy is the top bar. Headings use Newsreader. Body text uses Atkinson Hyperlegible. Dark mode uses the site's dark surfaces and the darker burgundy.

| Pane | Now |
|---|---|
| App bar | Burgundy chrome, ChatLegal, show or hide each side pane, colour theme, Clerk account, sign out |
| Left | Search, New chat, a Library link to `/library`, and the signed-in user's matters. Matters are empty until the first new chat. File names and the add form are not in this pane |
| Centre | The open matter's messages, its summary when one exists, and a text box. Send saves your words on that matter. A stored askChoice card renders in that transcript; the pick is saved on the same matter and the card locks. A reply is not written yet, and a model does not ask the question yet. An empty centre invites you to start a matter. `/` also shows the signed-in session. `/library` lists that user's library files above the thread |
| Right | Chat state for the open matter (its summary). A Markdown, image, PDF, or other file viewer appears only after Open on a library file. Closing it returns to chat state. The file text is not shown |

The product disclaimer stays under the panes. `/library` is the user workspace. `/matters` and `/work` still exist; their short notes render above the thread.

Matters are stored with `@mastra/libsql` in a local SQLite file. No database secret is required. Set `CHATLEGAL_MATTERS_DB` to a durable path on the host. To move off the file later, point that variable at a `libsql://` URL and set `CHATLEGAL_MATTERS_AUTH_TOKEN`, or replace `LibSQLStore` with `@mastra/pg`. Threads stay keyed by `clerk:<userId>` with metadata `kind: matter`.

Observational memory uses that same file. The Memory instance is created with `scope: 'thread'` and `retrieval: false`. A summary is read with the matter id, so a resource-wide row is not shown. Until `CHATLEGAL_OM_ENABLED` and `CHATLEGAL_OM_MODEL` are set, the observer does not run. A summary already stored for that matter is still shown. Opening a matter does not call a model. Send stores the user's message only.

Workspace files use Mastra `Workspace` and `LocalFilesystem` from `@mastra/core` 1.78.0. That provider needs a directory (`CHATLEGAL_WORKSPACE_ROOT`), which is separate from `CHATLEGAL_MATTERS_DB`. The library is `users/<user id>/library`. A matter the user owns is `users/<user id>/matters/<matter id>`. `POST /api/workspace/move` moves one file between those two places. The move checks the matter thread first, so another user's matter id returns 404 and the file stays where it was. Tools on the workspace stay disabled. There is no sandbox and no search index.

## Deferred

- Clerk Organizations, seats, and workspace switching.
- A model reply after Send. The user's message is stored. TODO(G-01 Concierge): stream the assistant reply. Turning on `CHATLEGAL_OM_MODEL` lets the observer write a summary later. It does not write that reply. It does not attach an agent to the workspace.
- A live model that emits `askChoice`. The centre pane already renders a stored card (one option, or several when `multiSelect` is set) and saves the pick on the matter (`clerk:<userId>`). A second pick is refused. TODO(G-01 Concierge): call `appendAskChoice` from the model tool and resume the run with `{ widget, version, answer }`. `allowCustom` is not part of that card. Dismiss and AG-UI resume are not wired. `POST /api/matters/:id/widgets` is the stub that stores a card without a model.
- AG-UI chat and TaskRunner.
- `hitly-net/hitl-spec@3410eda` schemas are not vendored yet.

Next slices should start from the pins in the pull request, not from a new layout.

## Checks

```bash
yarn test
yarn build
```
