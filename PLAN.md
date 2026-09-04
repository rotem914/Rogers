# Rogers · Plan v1

Date: 2026-09-04 · Status: revised after three external reviews (Claude, Gemini, GPT); architecture and steps approved. V1 = phases 0 to 7, PWA included. Tauri is V1.1, decided after living with the PWA. Every step in section 9 runs only after an explicit go.

Rogers is a personal, single-user notes app in the spirit of Google Keep, grouped by project. It runs on one Cloudflare Worker, is dark mode only, and is built so the same frontend ships as a website and an installable PWA in V1, and can become a Tauri desktop app in V1.1 without a rewrite.

Roles used in this document: **Me** = the coding agent (Claude Code) working inside the repo. **You** = Rotem: own terminal, browser, dashboard clicks, and eyes on the UI.

---

## 1. Goals and constraints

- Home page: grid of project tiles plus a "+" tile.
- Project page: Keep-style list view. Full-width rows in a centered column, a composer row at the top, a PINNED section above OTHERS.
- Note page: each note opens in its own page with a back arrow. Title, body, images. Mixed Hebrew and English text must align per paragraph.
- Images: paste (Ctrl+V), drag and drop, or file picker. Stored in R2.
- One deploy: a single Cloudflare Worker serves the API and the static frontend.
- Login: Cloudflare Access with an email one-time code. One user.
- Dark mode only. No light theme, no toggle, no media queries.
- Windows desktop: V1 delivers it as an installed PWA (own window, taskbar icon). The frontend stays host-agnostic so a Tauri shell can be added in V1.1 without a rewrite, only if native capabilities (global hotkey, tray, run at startup) turn out to be missed.
- Small steps, each approved individually. One agent, no parallel work.
- Free tier throughout: Workers, D1, R2, Access.

## 2. Changes vs. the original spec

The original spec (from a claude.ai chat) proposed Pages + Worker, then a single Worker with static assets. This plan keeps the single Worker and changes the following:

| Topic | Original | This plan | Why |
|---|---|---|---|
| Dev loop | `wrangler dev` on :8787, Vite separately | Cloudflare Vite plugin: one `npm run dev`, one port, hot reload for UI and Worker | Fewer moving parts |
| Schema | one `schema.sql` applied `--remote` only | `migrations/` folder applied to local and remote | Local dev uses a local D1; the original step 12 would fail with "no such table". Future column changes become one file each |
| API | GET/POST/PUT only | PATCH and DELETE for projects and notes, soft delete via `archived_at`, `pinned_at` | A Keep clone needs delete, rename, pin. Soft delete makes a mis-click recoverable |
| Project page | grid of cards | Keep list view: rows, composer at top, pinned section | Decided 2026-09-04 |
| Note editing | inline in the card | own page `/n/:id` with back arrow, plus inline in the composer | Decided 2026-09-04 |
| Images | upload + serve | plus size cap, image-only types, unguessable keys, cache headers | Basic hygiene |
| Desktop | not covered | host-agnostic SPA, PWA install in V1, Tauri v2 thin shell in V1.1 only if native capabilities are missed | New requirement |
| Deploy vs Access | separate phases | same sitting | The URL is public until Access is enabled |
| Who runs commands | user runs everything | Me runs all PowerShell steps; You only do wrangler login, dashboard clicks, the Rust install, and visual checks | Claude Code can run the shell |

The one extra idea: a PWA manifest right after Access is on. Edge installs the site as a Windows app in one click, with its own window and taskbar icon, and the email login works because it is the browser. Zero desktop code. The Tauri track then starts from a working baseline.

## 3. Architecture

```
                    ┌───────────────────── Cloudflare ─────────────────────┐
  Browser ──┐       │  Access (email code) ─ gate on the whole hostname     │
  Edge PWA ─┼─────▶ │        │                                              │
  Tauri ────┘       │        ▼                                              │
                    │  Worker "rogers"                                      │
                    │    ├─ /api/*  ─▶ Hono ─▶ D1 (projects, notes)         │
                    │    │                └─▶ R2 (images)                   │
                    │    └─ /*      ─▶ static assets = React SPA            │
                    └───────────────────────────────────────────────────────┘
```

```
J:\Projects\Rogers
├─ PLAN.md
├─ wrangler.jsonc        # Worker config, D1 + R2 bindings, assets dir, SPA fallback, /api/* to Worker
├─ vite.config.ts        # React + Cloudflare Vite plugin + Tailwind
├─ index.html
├─ migrations/           # D1 migrations: 0001_init.sql, ...
├─ src/
│  ├─ api/               # Worker: Hono routes (projects, notes, upload, images)
│  ├─ web/               # React SPA: pages, components, styles/tokens.css
│  │  └─ platform/       # api-client.ts (base URL, fetch) · platform.ts (web | tauri)
│  └─ shared/            # types used by both api and web
└─ desktop/              # phase 8: Tauri v2 (src-tauri, tauri.conf.json)
```

| Layer | Choice |
|---|---|
| Hosting | Cloudflare Workers with Static Assets, one deploy |
| API | Hono on the Worker, under `/api/*` |
| Database | D1 (SQLite), migrations folder |
| Files | R2 bucket for images, served through the Worker |
| Frontend | React 19, Vite, TypeScript, react-router, Tailwind v4 |
| Data layer | Plain `fetch` through one API client module, a small hook for loading and error state, refetch on page mount, local optimistic state for autosave, pin, archive. TanStack Query only if screens get slow or pages drift out of sync |
| Auth | Cloudflare Access, email one-time code, session length 1 month |
| Desktop | PWA install (V1). Tauri v2 thin shell (V1.1, only if native capabilities are missed; the remote frontend gets zero IPC permissions by default) |
| IDs | UUIDs generated in the browser: instant creation, offline mode stays possible later |

## 4. Data model

```sql
projects
  id          TEXT PRIMARY KEY           -- uuid
  name        TEXT NOT NULL
  color       TEXT                       -- optional accent
  created_at  TEXT NOT NULL
  updated_at  TEXT NOT NULL
  archived_at TEXT                       -- soft delete

notes
  id          TEXT PRIMARY KEY           -- uuid
  project_id  TEXT NOT NULL REFERENCES projects(id)
  title       TEXT NOT NULL DEFAULT ''
  body        TEXT NOT NULL DEFAULT ''
  images      TEXT NOT NULL DEFAULT '[]' -- JSON array of R2 keys
  pinned_at   TEXT                       -- null = not pinned
  created_at  TEXT NOT NULL
  updated_at  TEXT NOT NULL
  archived_at TEXT                       -- soft delete

index notes (project_id, archived_at, pinned_at, created_at)
```

Sorting on the project page: pinned notes first by `pinned_at` desc, then the rest by `created_at` desc.

Projects on Home: by `created_at` asc, the "+" tile last. No manual reorder in V1. A `position` column can be added by one migration if drag-to-reorder is ever wanted.

## 5. API

```
GET    /api/health
GET    /api/projects                 active projects, by creation
POST   /api/projects                 { id?, name }
PATCH  /api/projects/:id             { name?, color? }
DELETE /api/projects/:id             soft delete
GET    /api/projects/:id/notes       previews: title, clipped body, image keys, pinned; pinned first
POST   /api/projects/:id/notes       { id?, title?, body? }
GET    /api/notes/:id                full note
PATCH  /api/notes/:id                { title?, body?, images?, pinned? }
DELETE /api/notes/:id                soft delete
POST   /api/upload                   image/* up to 10 MB, returns { key }
GET    /api/images/:key              streams from R2, immutable cache headers, ETag
```

Bad input returns 400 with a message. Unknown ids return 404. Last write wins; there is one user.

## 6. UI

### Screens

```
HOME  /
┌─────────────────────────────────┐
│ Rogers                          │
├─────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌───────┐ │
│ │Kitchen │ │Car     │ │       │ │
│ │reno    │ │        │ │   +   │ │
│ │12 notes│ │3 notes │ │       │ │
│ └────────┘ └────────┘ └───────┘ │
└─────────────────────────────────┘
```

```
PROJECT  /p/:id   (composer collapsed)            PROJECT  /p/:id   (composer open)
┌──────────────────────────────────┐              ┌──────────────────────────────────┐
│ ‹  Kitchen reno                  │              │ ‹  Kitchen reno                  │
├──────────────────────────────────┤              ├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │              │ ┌──────────────────────────────┐ │
│ │ Take a note…           [img] │ │              │ │ Title                  [pin] │ │
│ └──────────────────────────────┘ │              │ │ Take a note…                 │ │
│ PINNED                           │              │ │ ┌───┐ ┌───┐                  │ │
│ ┌──────────────────────────────┐ │              │ │ │img│ │img│                  │ │
│ │ Podcasts               [pin] │ │              │ │ └───┘ └───┘                  │ │
│ │ Omri Dvir                    │ │              │ │ [img] [del]            Close │ │
│ │ Anna Lovesky                 │ │              │ └──────────────────────────────┘ │
│ └──────────────────────────────┘ │              │ PINNED                           │
│ OTHERS                           │              │ …                                │
│ ┌──────────────────────────────┐ │              └──────────────────────────────────┘
│ │ Hooks                        │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ [img] Kitchen quotes…        │ │
│ └──────────────────────────────┘ │
└──────────────────────────────────┘
```

```
NOTE  /n/:id
┌──────────────────────────────────┐
│ ‹  Kitchen reno   [pin]  ● saved │
├──────────────────────────────────┤
│ Title                            │
│                                  │
│ body, as long as you like,       │
│ RTL paragraphs align right,      │
│ LTR paragraphs align left        │
│                                  │
│ ┌────┐ ┌────┐ ┌────┐             │
│ │img │ │img │ │img │             │
│ └────┘ └────┘ └────┘             │
│                                  │
│ Ctrl+V or drop an image anywhere │
└──────────────────────────────────┘
```

### Behavior

**Home**
- Tiles show name and note count. The "+" tile turns into an inline name input.
- Tile menu: rename, color, archive.
- Tiles are ordered by creation. No manual reorder in V1.

**Project page**
- Single centered column, about 600 px wide, full-width rows. Rows show title, a clipped body preview, and small thumbnails when the note has images. Clicking a row opens the note page.
- Header: back arrow to Home, inline rename of the project.
- Composer (first row), modeled on Keep:
  - Collapsed: "Take a note…" with an image icon on the right. Clicking the text expands it with the cursor in the body. Clicking the image icon opens a file picker and expands with the image attached.
  - Expanded: Title, body, pin toggle top-right, bottom bar with image, delete, Close. Paste or drop images anywhere inside it.
  - Saving: a draft note is created on the first keystroke or paste and autosaved from then on, with the same serialized, coalesced saving as the note page. Close, or clicking outside, collapses the composer. An empty draft is discarded. The new row appears at the top of OTHERS, or of PINNED if pinned while writing.
- Pin: toggle on row hover, in the composer, and in the note page header. PINNED section sorted by pin time, everything else under OTHERS. Section headers appear only when something is pinned, as in Keep.
- Row menu: archive.

**Note page**
- Back arrow to the project (by project id, not browser history, so deep links work).
- Title, auto-growing body, image strip, pin toggle, saved indicator.
- Autosave: debounced, plus flush on blur and on back. Saves are serialized per note: at most one request in flight. Edits made meanwhile are coalesced into one pending state and sent as soon as the previous save returns. A save response never overwrites text typed after it was sent. Empty note is discarded on back.
- Each paragraph aligns by its own direction, so Hebrew and English mix cleanly. Mechanism: `unicode-bidi: plaintext` on the title and body editors, because `dir="auto"` alone picks one direction for the whole field. Enough for V1.
- Images: Ctrl+V, drag and drop with a drop highlight, remove button, click opens a lightbox, Esc closes.

**Session expiry (Access)**
- After the 1-month Access session ends, API calls receive a login redirect or HTML instead of JSON. The API client sends requests with `redirect: "manual"` and treats any redirect, any non-JSON response, or a 401/403 as an expired session: it parks unsaved text in sessionStorage, reloads the page so Access shows its login, and restores the text after login. Same code path for the website, the PWA, and a future Tauri shell.

**Offline**
- Website and PWA: a minimal service worker serves a dark offline page for navigations when the network is down. It caches nothing else, so no login HTML can ever be cached as API data.
- Inside the app, a failed request shows the error toast and keeps the unsaved text; autosave retries on the next change.

**Keyboard (optional)**
- N focuses the composer on the project page. Esc closes the composer or goes back.

## 7. Dark mode only

- `color-scheme: dark` on the root and in a meta tag. Native scrollbars, inputs, and selects go dark for free.
- One token palette (background, surface, border, text, muted, accent) as Tailwind v4 theme tokens. No `prefers-color-scheme`, no `dark:` variants, no toggle.
- `theme-color` meta and PWA `theme_color` / `background_color` dark.
- Tauri window theme set to dark so the Windows title bar matches.
- No white flash on reload: the HTML shell has the dark background inline before any CSS loads.

## 8. Desktop track

Infrastructure built in from phase 1, at near-zero cost:
- The SPA is host-agnostic: one API client module with a configurable base URL, a platform shim that knows whether it runs in a browser or in Tauri, no server-side rendering.
- The router is chosen by platform so deep links work in the browser and inside a desktop bundle.

Steps:
1. **PWA** (phase 7, V1). Manifest with `crossorigin="use-credentials"` on the manifest link, which Access requires, dark colors, icons. Edge → Install app → own window and taskbar icon.
2. **Tauri v2 thin shell** (phase 8, V1.1, only if native capabilities are missed after living with the PWA). The window loads the live URL. WebView2 keeps the Access cookie; with the session set to one month you log in about once a month. Real `.msi` / `.exe` installer. Tauri over Electron: about 10 MB instead of about 150 MB, uses the WebView2 already in Windows 11. Cost: install Rust and the Visual C++ build tools once. Security default: the remote frontend gets zero native/IPC permissions. Nothing goes into the Tauri capabilities file unless a specific native feature is built, and then only that permission, scoped to the live origin.
3. **Bundled mode** (V2, optional). SPA inside the exe, Access service token in request headers, Tauri HTTP plugin to avoid CORS, images loaded through the API client. Only if instant startup or an offline shell is wanted.

## 9. Step-by-step plan

Each line is one step with a done-when check (✓). Work stops after each step until approved. V1 = phases 0 to 7 and ends with the installed PWA. Phase 8 is V1.1 and starts only if, after living with the PWA, native capabilities such as a global hotkey, a tray icon, or run at startup are actually missed.

Execution rules for Me: every wrangler command runs non-interactively, with `--yes` / `-y` where the command supports it, in a shell without a TTY so wrangler auto-confirms the rest. Any prompt that still needs a human answer is handed to You instead of waiting. The account's workers.dev subdomain must exist before 6.1 so the first deploy does not prompt. Rotem starts every dev server himself, `npm run dev` in his terminal, and I drive it; I never start one, per CLAUDE.md rule 16. Pushing to GitHub is Rotem's alone; I commit, he pushes.

### Phase 0 · prerequisites

- [x] 0.1 **Me** · this file exists in the repo root. ✓ You read it and say go.
- [x] 0.2 **You** · Cloudflare account exists; run `npx wrangler login` in your own terminal. Also make sure the account has a workers.dev subdomain (Workers & Pages → Overview). ✓ `npx wrangler whoami` prints your account.
- [x] 0.3 **Me** · `git init`, `.gitignore` (node_modules, dist, .wrangler, .dev.vars), first commit. ✓ one commit in the log (a244ab1).
- [x] 0.4 **Me** · create the GitHub repo with `gh` and push. If `gh` is not logged in, You run `gh auth login` first. ✓ repo page opens. Done 2026-09-04: Rotem created github.com/rotem914/Rogers himself; main pushed.

### Phase 1 · skeleton

- [x] 1.1 **Me** · scaffold with the Cloudflare React + Vite + Workers template. ✓ You start `npm run dev`; the template page shows on localhost:5173.
- [x] 1.2 **Me** · restructure into `src/api` (Hono), `src/web`, `src/shared`. Worker config: assets dir, SPA fallback, `/api/*` always routed to the Worker. ✓ `/api/health` returns JSON, any other path returns the app shell.
- [x] 1.3 **Me** · dark-only foundation: tokens, root color-scheme, Tailwind v4, theme-color meta, app shell with a top bar. ✓ dark page, dark scrollbars, no white flash on reload.
- [x] 1.4 **Me** · routes Home `/`, Project `/p/:id`, Note `/n/:id` as placeholders; API client module with the Access expiry handling from section 6; small data hook (loading, error, refetch); platform shim. ✓ reloading a note URL works; a mocked redirect from the API triggers the reload path instead of a crash.
- [x] 1.5 **Me** · commit; You push.

### Phase 2 · database

- [x] 2.1 **Me** · `wrangler d1 create rogers-db`; add the binding with its id. ✓ `wrangler d1 list` shows it.
- [x] 2.2 **Me** · `migrations/0001_init.sql` per section 4, including `pinned_at`; npm scripts `db:migrate:local` and `db:migrate:remote`. ✓ local apply, both tables listed.
- [x] 2.3 **Me** · apply the migration remotely. ✓ same check with `--remote`.
- [x] 2.4 **Me** · `wrangler types` for Env; shared types in `src/shared`. ✓ `tsc` clean. Commit.

### Phase 3 · API

- [ ] 3.1 **Me** · list and create projects. ✓ curl create, then list shows it.
- [ ] 3.2 **Me** · update and soft-delete projects. ✓ curl.
- [ ] 3.3 **Me** · list (previews, pinned first) and create notes per project. ✓ curl.
- [ ] 3.4 **Me** · get, update (incl. pinned), soft-delete a single note. ✓ curl.
- [ ] 3.5 **Me** · input checks with 400 and 404 responses. ✓ a bad body gives 400. Commit.

### Phase 4 · frontend

- [ ] 4.1 **Me** · Home: project tiles from the API plus a "+" tile with inline name input. ✓ **You** create a project, refresh, it is still there.
- [ ] 4.2 **Me** · tile menu: rename, color, archive. ✓ You try each.
- [ ] 4.3 **Me** · Project page: back arrow, inline rename, centered list of rows with previews, newest first. ✓ rows render from the API.
- [ ] 4.4 **Me** · composer: collapsed bar, expand and collapse with Close and click-outside. ✓ click expands with focus in the body, Close collapses.
- [ ] 4.5 **Me** · composer persistence: draft on first change, serialized and coalesced autosave, discard if empty. ✓ **You** type, Close, the row is at the top. Open, Close without typing, nothing added.
- [ ] 4.6 **Me** · Note page: back arrow, title and body editing, serialized and coalesced autosave with saved indicator, flush on blur and on back, per-paragraph bidi alignment, pin in the header. ✓ **You** type Hebrew and English paragraphs, wait a second, refresh. Then type fast while a save is in flight and refresh: the last text wins.
- [ ] 4.7 **Me** · pin: PINNED and OTHERS sections, hover pin on rows, pin in the composer. ✓ pin a note, refresh, it stays in PINNED.
- [ ] 4.8 **Me** · archive from the note menu and a row menu; empty note discarded on back. ✓
- [ ] 4.9 **Me** · keyboard: N focuses the composer, Esc closes it or goes back. Optional.
- [ ] 4.10 **Me** · empty states, loading skeletons, error toast. Commit; You push.

### Phase 5 · images

- [ ] 5.1 **Me** · `wrangler r2 bucket create rogers-images`; binding. ✓ bucket list shows it.
- [ ] 5.2 **Me** · upload endpoint (10 MB cap, image types only, uuid keys) and image endpoint with cache headers. ✓ curl upload, then the URL opens in the browser.
- [ ] 5.3 **Me** · Ctrl+V in the composer and on the note page uploads and shows a thumbnail; key stored on the note. ✓ **You** paste a screenshot, refresh.
- [ ] 5.4 **Me** · drag and drop in both places with a drop highlight, file picker behind the image icon, remove button, thumbnails in row previews. ✓
- [ ] 5.5 **Me** · thumbnail click opens a lightbox, Esc closes. Commit; You push.

### Phase 6 · deploy (same sitting as phase 7)

- [ ] 6.1 **Me** · `npm run deploy`. ✓ **You** open the workers.dev URL: the app shell loads and `/api/health` answers. Sanity check only, create nothing. Go straight to phase 7.
- [ ] 6.2 **Me** · deploy script in package.json, commit; You push. Optional later: GitHub Actions deploy on push, needs an API token You create.

### Phase 7 · login and install

- [ ] 7.1 **You** · dashboard: Workers & Pages → rogers → Settings → Domains & Routes → workers.dev → Enable Cloudflare Access. Then Zero Trust → Access → Applications → rogers: policy Allow, Emails = yours, session duration 1 month. A custom hostname is possible if you own a domain on Cloudflare. ✓
- [ ] 7.2 **You** · incognito, open the URL, email code, you are in. ✓ the API path without login redirects to the login page. Then revoke the session in Zero Trust and click inside the app: you land on the login page, not on a broken screen.
- [ ] 7.3 **Me** · PWA manifest with the credentials flag, dark theme colors, icons, and the minimal offline-page service worker from section 6; deploy. ✓ **You** Edge → Install app → Rogers opens as a Windows window with its own taskbar icon. Airplane mode, open the installed app: the dark offline page, not a browser error.

### Phase 8 · V1.1, only if native capabilities are missed: Windows desktop with Tauri v2

- [ ] 8.1 **You** · `winget install Rustlang.Rustup`; accept the installer's offer to install the Visual C++ build tools. A few GB, once. ✓ `cargo -V` works.
- [ ] 8.2 **Me** · `desktop/` via Tauri init. Window config: dark theme, dark background, title, identifier, an empty capabilities set for the remote frontend (zero native/IPC permissions), and `dragDropEnabled: false` so HTML5 drag-and-drop reaches the page instead of WebView2 opening the dropped file (Tauri v1 called this `fileDropEnabled`). The window loads a tiny local loader page: it probes the live URL and navigates to it; if unreachable it shows a dark offline screen with Retry, so an offline launch never shows a browser error. ✓ You start `npm run tauri dev`; a dark window opens with the app; You log in once inside it; with the network off, the offline screen appears; dropping an image onto a note works.
- [ ] 8.3 **Me** · icons generated from the same PNG as the PWA. ✓ window and taskbar icon.
- [ ] 8.4 **Me** · Tauri build. ✓ **You** install the `.msi` from the bundle folder, launch from the Start menu.
- [ ] 8.5 **Me, optional** · global hotkey Ctrl+Shift+K brings the window up and focuses the composer; tray icon; run at startup. Each opens only the specific Tauri permission it needs, scoped to the live origin.
- [ ] 8.6 **Me, optional, V2** · bundled mode: SPA inside the exe, Access service token, Tauri HTTP plugin.

Phases 0 to 5 run fully local with no login. Phases 6 and 7 happen in one sitting because the URL is public in between, and no real data goes in before Access is verified in 7.2. V1 ends at 7.3 with the installed PWA.

## 10. Open decisions

1. Name: the folder says Rogers, the original spec said keep-projects. Assumed: Rogers.
2. Resolved 2026-09-04: Tauri is V1.1, decided after living with the PWA. No Rust install in V1.
3. Resolved 2026-09-04: no TanStack Query. Plain fetch plus a small hook. V1 libraries: react-router, Tailwind v4.

## 11. Out of scope for v1

- Keep's checklist, drawing, color picker, reminders, collaborators. Color is the easy one to add later.
- Manual drag-to-reorder of notes (the list is pinned first, then newest first).
- Search across projects, labels, multi-user, offline mode.
- Cleanup of orphaned images in R2.
- TanStack Query: only on a felt need. Tauri shell: V1.1, only if native capabilities are missed.
- Project reorder on Home: no position column in V1, one migration away if wanted.

## 12. Review log

**Claude (claude.ai), 2026-09-04**
- PWA in V1: accepted.
- Tauri: moved out of V1, only if the PWA is not enough. Accepted. Relabeled V1.1 in the GPT round.
- TanStack Query: dropped in favor of plain fetch plus a small hook. Accepted.

**Gemini, 2026-09-04**
- Access session expiry breaks API calls (redirect or HTML instead of JSON): accepted. Handled in the API client in step 1.4, verified in 7.2. Applies to plain fetch exactly as it would to a query library.
- Tauri drag and drop: accepted for phase 8. The Tauri v2 setting is `dragDropEnabled: false`; `fileDropEnabled` is the v1 name.
- Offline launch of the Tauri thin shell: accepted, local loader page in 8.2. Extended to the PWA in 7.3, which has the same problem.
- Wrangler prompts can block the agent: accepted, execution rules added at the top of section 9.
- Project `position` column with no reorder UI: accepted, column dropped, projects ordered by creation.
- Rive animation instead of loading skeletons: rejected. It adds a runtime and a design-tool dependency for a state that is rarely visible on a Worker + D1 backend, and goes against the lean direction of this round. CSS skeletons stay. Can be revisited as polish.

**GPT, 2026-09-04**
- Phase 8 relabeled V1.1: accepted. Decided after living with the PWA, based on whether a global hotkey, tray icon, or run at startup are actually missed.
- Autosave serialized and coalesced per note: accepted. Section 6, steps 4.5 and 4.6.
- No real data before Access: accepted. 6.1 is a sanity check only.
- Bidi wording "per paragraph": accepted. The mechanism is `unicode-bidi: plaintext`, since `dir="auto"` alone sets one direction for the whole field.
- Tauri remote frontend gets zero native/IPC permissions by default: accepted. Section 8 and step 8.2.
- Architecture and steps approved.
