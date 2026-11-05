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
| `CHATLEGAL_EMBED_ENABLED` | Optional. The word `true` turns on prepared search for library and matter files. Anything else, including unset, leaves it off |
| `CHATLEGAL_EMBED_MODEL` | Required when prepared search is on. The model id sent to the embeddings endpoint. If this is empty, search stays off |
| `CHATLEGAL_EMBED_BASE_URL` | Required when prepared search is on. An `http` or `https` embeddings URL, for example `http://127.0.0.1:11434/v1`. A password or query string in the URL is refused. No provider secret is read |

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
- `GET /api/matters`, `POST /api/matters`, and `PATCH /api/matters/:id` use that same Clerk user id. A matter id from someone else is not returned.
- Sign-out returns to `https://app.chatlegal.uk/sign-in`.
- The home page shows the Clerk user id and session id when a session exists.
- New chat creates a matter thread in Mastra memory (`@mastra/core` 1.78.0, `@mastra/memory` 1.36.0, `@mastra/libsql` 1.26.2) and stores a scripted first turn on it. That turn says ChatLegal is not a solicitor, asks what happened, where, and what you have, and points at the hard-escalate pages (money, crime, immigration, children, deadlines, and the other stops in the referral map). Two askChoice cards record the place and the papers. Answering one stores the pick and a short templated note. No model is called. The left pane lists those threads for `clerk:<userId>`. Opening a row loads that thread into the centre. Rename stores a new title on the thread (`PATCH /api/matters/:id`). Archive hides the row and leaves the thread and its messages in the same database. Show archived is not in this slice. An empty list offers New chat. The composer draft is kept for that matter (and in `localStorage`, so a reload keeps it). Send appends that text to the thread (`POST /api/matters/:id/messages`, scoped to `clerk:<userId>`). The message waits in the centre pane until it is stored. A send that fails or takes longer than 20 seconds stays in that queue, and sends again when the connection returns. Try again sends it now. Nothing in the queue is a model reply.
- Each matter can keep a summary in Mastra observational memory, scoped to that thread (`clerk:<userId>` plus the matter id). The centre column shows that summary when one exists. The right pane shows it as chat state until a file is opened. Another matter's summary is not loaded. The observer model stays off unless `CHATLEGAL_OM_ENABLED` is `true` and `CHATLEGAL_OM_MODEL` is set, so opening a matter does not call a model.
- Library is a link in the left pane. It opens `/library`, the signed-in user's Mastra workspace (`LocalFilesystem`, tools off, no sandbox). That page lists the user's files and can add one (`GET` and `POST /api/library`). The open matter still has its own workspace. `/work` lists that matter's files and can upload a PDF, Word document (`.docx`), or Markdown file (`.md`) into it (`POST /api/matters/:id/files` as multipart). The file limit is 10 MB. Other types are refused. There is no virus scan. A Word document is stored as the uploaded bytes and is not shown in the viewer; the pane offers a download. PDF and Markdown open in the right pane. A library file can be copied onto the open matter, or moved either way (`POST /api/workspace/move`, with `mode` `copy` or `move`). Add keeps the library copy. The left pane stays a link to Library and does not list files. Another person's matter is 404. There is no agent yet, so Send does not ask a model to reply. Prepared search of the words in those files stays off unless `CHATLEGAL_EMBED_ENABLED`, `CHATLEGAL_EMBED_MODEL`, and `CHATLEGAL_EMBED_BASE_URL` are set. When search is on, preparing the index reads text, Markdown, PDF, and Word (`.docx`). A scanned PDF is skipped. There is no OCR. Chat does not query that index.
- The left pane footer keeps a plan card in view while history scrolls. It shows Basic, free, and the default model class Small (chatlegal-1). Remaining use is not counted yet. Upgrade is closed. Nothing is billed, and no billing or model setting is read. The class is a label. Send does not call that model.

## Shell

Signed-in pages use three panes. The left and right panes can be hidden from the top bar, from the pane header, or from the chevron on that pane's edge. A hidden pane leaves a slim rail with the same chevron, and the centre column takes the freed width. That choice is stored in `localStorage` (`chatlegal.shell.leftOpen`, `chatlegal.shell.rightOpen`). On a wide screen, Escape shows chats again when both panes are hidden. The right pane width still drags (`chatlegal.chat.sidebarWidth`).

Colour is the docs-site M1 palette, in `app/globals.css`. Shadcn names point at those tokens. Cream is the page, raised cream is the side panes and cards, ink and muted ink are the type, teal is for links, and burgundy is the top bar. Headings use Newsreader. Body text uses Atkinson Hyperlegible. Dark mode uses the site's dark surfaces and the darker burgundy.

| Pane | Now |
|---|---|
| App bar | Burgundy chrome, ChatLegal, show or hide each side pane, colour theme, Clerk account, sign out |
| Left | Search, New chat, a Library link to `/library`, the signed-in user's chats (open, and a ⋮ menu to rename or archive), a New chat prompt when the list is empty, and a plan card pinned at the foot (Basic, free, Small / chatlegal-1, remaining not counted, Upgrade closed). Chats are empty until the first new chat. Archive hides a chat from this list and keeps it stored. File names and the add form are not in this pane |
| Centre | The open matter's messages, its summary when one exists, and a text box. The text box shows that same default class. It is not a picker. A new matter opens on the scripted first turn (notice, what happened / where / what you have, and the hard-escalate links). Send saves your words on that matter. If the save fails or times out, the words stay in a waiting list on that matter and send again when the connection returns. A stored askChoice card renders in that transcript; the pick is saved on the same matter and the card locks. A first-turn card adds a templated note. A model does not write a reply and does not ask a new question. An empty centre, before any matter is open, invites you to start one. `/` also shows the signed-in session. `/library` lists that user's library files above the thread. With a chat open, the selected file can be copied onto that matter or moved there |
| Right | Chat state for the open matter (its summary). A Markdown, image, or PDF viewer appears only after Open on a library file or a matter file. A Word document offers a download and is not shown. Closing it returns to chat state. The file text is not shown in the list |

The product disclaimer stays under the panes. `/library` is the user workspace. `/chats` is the chat list page. `/matters` redirects there so an old bookmark still opens. `/work` lists files on the open chat, accepts a PDF, Word, or Markdown upload up to 10 MB, and can copy a library file onto that chat. Those notes render above the thread.

Matters are stored with `@mastra/libsql` in a local SQLite file. No database secret is required. Set `CHATLEGAL_MATTERS_DB` to a durable path on the host. To move off the file later, point that variable at a `libsql://` URL and set `CHATLEGAL_MATTERS_AUTH_TOKEN`, or replace `LibSQLStore` with `@mastra/pg`. Threads stay keyed by `clerk:<userId>` with metadata `kind: matter`.

Observational memory uses that same file. The Memory instance is created with `scope: 'thread'` and `retrieval: false`. A summary is read with the matter id, so a resource-wide row is not shown. Until `CHATLEGAL_OM_ENABLED` and `CHATLEGAL_OM_MODEL` are set, the observer does not run. A summary already stored for that matter is still shown. Opening a matter does not call a model. Send stores the user's message only.

Workspace files use Mastra `Workspace` and `LocalFilesystem` from `@mastra/core` 1.78.0. That provider needs a directory (`CHATLEGAL_WORKSPACE_ROOT`), which is separate from `CHATLEGAL_MATTERS_DB`. The library is `users/<user id>/library`. A matter the user owns is `users/<user id>/matters/<matter id>`. A multipart upload on `POST /api/matters/:id/files` writes PDF, `.docx`, or `.md` bytes into that matter directory. The limit is 10 MB (`10_485_760` bytes). A larger file, or any other type, is refused in a short sentence. The original bytes are what get stored. `POST /api/workspace/move` moves one file between the library and a matter. The same route copies when `mode` is `copy`, and the source stays. A missing `mode` still moves. The call checks the matter thread first, so another user's matter id returns 404 and the file stays where it was. Tools on the workspace stay disabled. There is no sandbox. Prepared search, when the embed settings are on, stores vectors in a separate libSQL file under the same workspace root (`users/<user id>/index/library.db` and `users/<user id>/index/matters/<matter id>.db`). That file is not `CHATLEGAL_MATTERS_DB`. `GET` and `POST /api/library/index`, and the same pair under `/api/matters/:id/index`, prepare and search one scope. When the settings are unset, those routes return an empty result and the sentence "Search across the words in your files is turned off." They do not call an embeddings endpoint. When the embed settings are on, preparing search reads the words in a PDF or Word file (`.docx`) as well as text and Markdown. The original bytes stay as uploaded. A scanned PDF has no text layer and is skipped, because there is no OCR. A Word document in the right pane is still a download. A move drops prepared rows in the place the file left. A copy keeps them. Send does not call these routes. Concierge and TaskRunner stay off. No LiteLLM proxy is configured.

## Deferred

- Clerk Organizations, seats, and workspace switching.
- A billed plan. The card is a stub: Basic, free, Small / chatlegal-1, remaining not counted, Upgrade closed. Usage events and a billing provider are later slices.
- Choosing another model class. Basic stays on Small (chatlegal-1). Medium, Large, and SOTA are not offered. No proxy is called.
- A model reply after Send. The user's message is stored. TODO(G-01 Concierge): stream the assistant reply. Turning on `CHATLEGAL_OM_MODEL` lets the observer write a summary later. It does not write that reply. It does not attach an agent to the workspace. TODO(D-04): chat does not query the file index.
- OCR for a scanned PDF. Plain text in a PDF or Word file can be prepared when search is on. A scan with no text layer is skipped.
- Concierge and TaskRunner. TODO(G-00): they stay off. Prepared search does not start them. LiteLLM stays unset.
- Showing archived matters again. Archive hides a matter from the default list. The thread stays in the matters database. There is no hard delete.
- A live model that emits `askChoice`. The centre pane already renders a stored card (one option, or several when `multiSelect` is set) and saves the pick on the matter (`clerk:<userId>`). The new-matter cards are written by the template, not by a model. A second pick is refused. TODO(G-01 Concierge): call `appendAskChoice` from the model tool and resume the run with `{ widget, version, answer }`. `allowCustom` is not part of that card. Dismiss and AG-UI resume are not wired. `POST /api/matters/:id/widgets` is the stub that stores a card without a model.
- AG-UI chat and TaskRunner.
- `hitly-net/hitl-spec@3410eda` schemas are not vendored yet.

Next slices should start from the pins in the pull request, not from a new layout.

## Checks

```bash
yarn test
yarn build
```
