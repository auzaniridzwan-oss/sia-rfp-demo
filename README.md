# SIA RFP Demo — Singapore Airlines + Scoot mock booking sites

Two mock airline sites (Singapore Airlines and Scoot) that share one codebase and one Braze workspace. They are used to demo cross-entity identity, consent propagation and user journeys for the SIA Group RFP. The full plan is in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Live sites

| Site | URL | Vercel project |
|---|---|---|
| Singapore Airlines | https://sq-demo-seven.vercel.app | `sq-demo` (root `apps/sq-web`) |
| Scoot | https://scoot-demo-pied.vercel.app | `scoot-demo` (root `apps/tr-web`) |

Every push to `main` deploys both.

## Layout

| Path | What |
|---|---|
| `apps/sq-web` | Singapore Airlines site (`entity: SQ`) — Vite + React + TS |
| `apps/tr-web` | Scoot site (`entity: TR`) |
| `apps/*/api` | Vercel functions (thin wrappers that bind the entity and call `@sia/server`) |
| `packages/theme` | Shared Tailwind preset + `applyTheme(tokens)`; each app ships its own `src/theme/tokens.json` |
| `packages/core` | Brand-agnostic TS: `BrazeClient`, typed event catalog, CEID identity, storage, logger, Zod schemas, booking rules + store |
| `packages/react` | `BrazeProvider` and hooks (`useTrack`, `usePageView`, `useContentCards`, `useBanner`, `useBrazeProfile`, `useBooking`) |
| `packages/ui` | Shared components: `<BrazeDebug />` overlay |
| `packages/data` | Destinations, ancillary catalogues; SerpAPI fixtures (server-only: `@sia/data/fixtures`) |
| `packages/server` | Request handlers: `/api/flights` (SerpAPI + cache + fixture fallback), `/api/braze/profile`, `/api/health` |
| `braze/schema.json` | Generated event/attribute dictionary (`pnpm schema:export`) |
| `scripts/` | `dev-api.ts`, `serpapi-spike.ts`, `gen-fixture-index.ts`, `export-schema.ts` |

## Setup

```bash
corepack enable          # once, provides pnpm 9 from packageManager
pnpm install
pnpm dev:api             # local /api on :3000 (reads .env)
pnpm dev:sq              # http://localhost:5173
pnpm dev:tr              # http://localhost:5174
pnpm test                # unit tests
```

Add `?debug=true` (or press Shift+D) to open the Braze debug overlay. Any `@example.com` email in the sign-in harness becomes a `ceid_test_` user.

Copy `.env.example` to `.env` at the repo root for scripts (SerpAPI, Braze REST). Never commit `.env`. The Braze **Web SDK** keys are public and already defaulted in each app's `brand.config.ts`.

## Braze

Workspace "[AR]-Demo-Singapore Airlines", SDK endpoint `sdk.iad-03.braze.com`. One web app per site; keys are in each app's `.env.example`.

## Deploy (Vercel)

There are two Vercel projects on this repo. Set the root directory to `apps/sq-web` for one project and `apps/tr-web` for the other. Framework preset: Vite. Server-only env vars: `SERPAPI_KEY`, `BRAZE_REST_API_KEY`, `BRAZE_REST_URL`, `DEMO_ADMIN_TOKEN`.
