# J & L Transportation — website

Rebuild of [jltrans.com](https://jltrans.com/). Astro + TypeScript + Tailwind, static, deployed
to Netlify.

## Quick start

```bash
npm install
cp .env.example .env   # then edit the two secrets
npm run dev            # http://localhost:4321
```

`astro dev` covers everything including `/do-i-work`, reading the two secrets from `.env`. To
exercise the production shape instead — the built bundle plus the on-demand route as a real
Netlify Function, with `_redirects` applied:

```bash
npm i -g netlify-cli   # once
npm run build
npm run preview        # netlify dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs the spam scan before and after) |
| `npm run build:launch` | Launch build — **also fails on unresolved `TODO_CLIENT` blanks** |
| `npm run preview` | Serve the build through `netlify dev`, including the on-demand route |
| `npm run check` | `astro check` — types and template diagnostics |
| `npm run scan` | Clean-room guard over `src/`, `public/`, `dist/` |
| `npm run todos` | **The client punch-list** — every unresolved `TODO_CLIENT` and where it is |

## Two things to know before editing

### 1. This site replaces a compromised install

The old WordPress site served cloaked Japanese counterfeit-goods spam to search engines via
injected `buy.php` / `item.php` gateways and a rewritten `robots.txt`. Browsers saw the real
site, which is why it went unnoticed for a long time.

Consequently **nothing is copied from the old server except prose.** No PHP, no database, no
theme or plugin directories, no `robots.txt`, no HTML lifted from old pages. Images and PDFs are
re-encoded rather than passed through.

`scripts/scan-spam.mjs` enforces this on every build (CJK codepoints, spam signatures, an
outbound-domain allowlist, insecure `http://` subresources). If it fails, read the message
before working around it. To allow a genuinely new external host, add it to `ALLOWED_HOSTS`
in that file — deliberately, as a one-line reviewable change.

### 2. Facts we do not have yet are loud, not blank

Unresolved client details are `TODO_CLIENT('label')` in `src/data/site.ts`. They render as a
visible `[NEEDS: label]`, never an empty string — the old site displayed a bare `Address:`
label for years precisely because a blank looked fine.

`npm run build` warns about these. `npm run build:launch` **fails** on them, so the site cannot
go to production with a hole in it.

Run `npm run todos` for the current list.

## Layout

```
src/
  data/          site.ts (single source of truth for contact details), nav.ts
  lib/           pure TS: auth.ts, seo.ts, format.ts
  content/       team/ faq/ news/ — Markdown, schema-validated
  components/
    primitives/  design-system atoms, no business knowledge
    blocks/      composed page sections
    cards/       five variants, all built on primitives/Card.astro
  layouts/       BaseLayout, PageLayout
  pages/         8 routes
scripts/         scan-spam.mjs
```

### Conventions

- **Reuse before creating.** Check `primitives/` before adding a component, `site.ts` before
  adding a constant. All five card variants build on `primitives/Card.astro` — do not restyle a
  card surface locally.
- **Contact details only from `site.ts`.** Enforced in CI.
- **Server-first.** No `client:*` directives anywhere; the mobile nav is plain `<script>` and the
  FAQ is native `<details>`. Enforced in CI.
- **Typed props.** Every component declares `interface Props`. No `any`.
- **Tokens, not hex.** Colors and spacing come from the `@theme` block in
  `src/styles/global.css`.
- **Use the platform.** `<Image>` from `astro:assets` over hand-written `<img>`; native elements
  over custom widgets.

## Notes on the platform

- **The adapter exists for exactly one route.** `output` is `static`; only `/do-i-work` sets
  `prerender = false`, so the build emits plain files plus one Netlify Function. Adding a second
  on-demand route is a deliberate decision, not a default.
- **`_redirects` is one ordered file.** `public/_redirects` holds the old WordPress URL map and the
  adapter *appends* its on-demand-route rules to it at build time. Netlify applies the first match,
  so do not also declare redirects in `netlify.toml` — two sources would silently disagree.
- **Images are resized at build time.** The adapter is configured with `imageCDN: false` so Sharp
  does the work during the build rather than deferring to Netlify Image CDN at request time.
- **TypeScript is pinned to 6.x**, not 7. `@astrojs/check@0.9.9` peers on `^5 || ^6`, and TS 7
  fails to install.
- **Don't use `Astro.clientAddress`** for the rate limiter. It is only defined on on-demand routes
  and its unavailable-behaviour is adapter-specific. Read `x-nf-client-connection-ip`, which Netlify
  sets on every request — see `src/pages/do-i-work.astro`.
- **Secrets go through `astro:env`, never `import.meta.env`.** Vite statically replaces
  `import.meta.env.X` at build time, so reading them that way wrote both secrets as literals into
  the built function bundle — which trips Netlify's secrets scanning and freezes the values into
  every deploy artifact. They are declared `access: 'secret'` in `astro.config.mjs` and read at
  request time in `src/lib/env.ts`, the only module that touches them.
- **Internal links carry a trailing slash** (`/about/`, not `/about`). The build emits directory
  URLs — matching the old WordPress convention so inbound links keep working — and the bare form
  costs a 307 hop on every click.

## Deploy

Netlify. Build settings live in `netlify.toml` (publish `dist/`, Node 20), so the only things to
do in the Netlify UI are connect the repo and set the secrets.

1. **Create the site** — Netlify → Add new site → Import an existing project → this Git repo.
   Leave the build settings alone; `netlify.toml` supplies them.
2. **Set the two secrets** — Site configuration → Environment variables. Never in the repo:

   | Key | Value |
   |---|---|
   | `DO_I_WORK_PASSWORD` | the shared password J&L hands out |
   | `AUTH_SECRET` | `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |

   Scope them to **all deploy contexts** — production, deploy previews and branch deploys — or
   `/do-i-work` renders its "Not configured" state there. Mark both **Secret** so the values are
   write-only afterwards. Changing either invalidates every existing session, which is the
   intended way to revoke access.
3. **Deploy**, then check `/do-i-work` returns the password form (not the content) and that a
   stale URL such as `/download-points-list` still 301s.
4. **Custom domain** — Domain management → add `jltrans.com`. Do this before switching DNS so the
   certificate is issued and ready.

### The launch gate

`netlify.toml` currently builds with `npm run build`. The difference matters:

| | unresolved `TODO_CLIENT` |
|---|---|
| `npm run build` | warns, deploys with visible `[NEEDS: ...]` labels |
| `npm run build:launch` | **fails the build** |

Pre-launch that gate is off so the scaffold deploys and can be reviewed with its holes showing.
**At launch, switch `netlify.toml` to `npm run build:launch`** — from then on a missing client
detail breaks the deploy rather than shipping a `[NEEDS: ...]` label to the public site.
`npm run todos` lists what is outstanding.

Before pointing DNS at the new site, run the launch checklist in the project plan — in
particular the **cloaking check**: fetch every route with a Googlebot user-agent and confirm the
response is byte-identical to a normal browser request. That is the check that surfaced the
original compromise.
