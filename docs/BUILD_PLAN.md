# SIA Group Demo Websites — Build Plan (for review)

**Status:** v0.4 · 2026-11-19 · Phase 0 complete; both sites live. All decisions D1–D13 are made (see §8).

| Version | Change |
|---|---|
| 0.1 | Initial plan |
| 0.2 | Brand tokens (§2a) and ancillary catalogues (§2b) now taken from the brand-asset Drive folder (`singaporeair-design-tokens.md`, `scoot-design-tokens.md`, `singaporeair-ancillaries.md`, `scoot-ancillaries.md`). Replaced my earlier guessed ancillary and seat names; the Scoot brand-extraction step is no longer needed. |
| 0.3 | Decisions D1–D13 applied: React + TypeScript rewrite, destinations served by both SQ and TR (London dropped), workspace and SDK keys, Marcellus display font, Scoot logo, illustrative Scoot prices, one generic Scoot bundle, `sia_page_viewed` on by default. Estimate increased for the rewrite. |
| 0.5 | Phases 1–4 built and live; decisions D14 (subscription groups) and D15 (consent schema extension) added. |
| 0.4 | Phase 0 results: destinations validated by SerpAPI (D4); Braze REST endpoint confirmed as `rest.iad-03.braze.com`. |

**Inputs reviewed**
- `siademo-web` — SIA shell, hero + booking widget, SerpAPI proxy (`/api/serpapi/flights|fares|pricing-trend`), fare grid (Lite/Value/Standard/Flexi), registration gate, debug drawer + REST profile proxy (`/api/braze/user-data`). **No** ancillary/seat/payment steps.
- `cebupacific` — full funnel: hero carousel, passenger → ancillaries → seat map → payment → confirmation, abandonment event. Weaker Braze REST/debug tooling.
- SIA Presentation Draft — TST Loops 1 (cross-entity identity + retargeting), 2 (consent propagation), 3.A/3.B (loyalty, trip lifecycle), and the **Demo Data** tab (schema, catalogs, segments).

Both repos share the same skeleton (Vite + vanilla JS + Tailwind + Flowbite, `BrazeManager` / `StorageManager` / `AppLogger`). With the React + TypeScript rewrite (D2), they serve as the **reference for behaviour and Braze logic**, not as code to copy file by file.

---

## 1. Recommendation: build new, as one monorepo

**Build a new monorepo `sia-group-demo`** that ports the best of both repos, rather than upgrading `siademo-web` in place and forking it for Scoot.

Why:
- Two sites must emit *identical* event/attribute shapes (the whole point of Loop 1 is that one profile reads SQ and TR behaviour the same way). One shared tracking package guarantees that; two forked repos drift.
- The future hands-on POC (RFP 12.3.4(e), POC 3b) needs the same mock SQ + Scoot sites — a monorepo lets a third brand (Kris+, or a client's UAT tag) be added as config, not a copy.
- The Cebu repo stays untouched as its own demo.

**Stack (D2, decided):** React 18 + TypeScript (strict), built with Vite.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Styling:** Tailwind with one preset per brand, generated from `tokens.json`. Radix UI primitives for accessible dialogs, tabs and selects, replacing Flowbite.
- **Routing and state:** React Router; TanStack Query for SerpAPI and REST calls; Zustand for the booking flow state.
- **Validation:** Zod schemas, shared by the client and the serverless functions.
- **Testing:** Vitest for the unit tests that matter (booking rules, event payloads); Playwright for one smoke test per site.

Braze lives in a `BrazeProvider` context with hooks: `useBraze()`, `useTrack()` (the typed event catalog), `useContentCards(placement)`, `useBanner(placement)`, `useBrazeProfile()`.

### Repo layout

```
sia-group-demo/
├─ apps/
│  ├─ sq-web/                 # Singapore Airlines site (Vite + React + TS, Vercel project #1)
│  │  ├─ src/brand.config.ts  # entity:'SQ', routes, fare families, copy, placement IDs
│  │  ├─ src/theme/           # tokens.json → tailwind preset + CSS variables; Marcellus + Proxima Nova
│  │  ├─ public/              # SIA logo, imagery
│  │  └─ api/*.ts             # thin Vercel functions → packages/server
│  └─ tr-web/                 # Scoot site (Vercel project #2), same shape, entity:'TR', Scoot logo
├─ packages/
│  ├─ core/                   # brand-agnostic TS (no React)
│  │  ├─ braze/               # SDK wrapper, identity (CEID), typed event catalog, consent client
│  │  ├─ booking/             # booking rules + Zustand store (search→select→pax→anc→seat→pay→confirm)
│  │  ├─ schemas/             # Zod schemas shared by client and server
│  │  └─ storage/ logger/     # storage (prefix per entity), AppLogger
│  ├─ react/                  # BrazeProvider + hooks (useTrack, useContentCards, useBanner, useBrazeProfile)
│  ├─ ui/                     # shared React components, styled only via semantic theme tokens
│  │  ├─ shell/ home/ booking-steps/ account/ preference-centre/
│  │  └─ debug-overlay/       # <BrazeDebug /> drawer
│  ├─ data/                   # ancillaries, seat maps, promos, destinations, SerpAPI fixtures — per entity
│  └─ server/                 # handlers: serpapi proxy, braze REST proxy, consent, catalog writer, seed
├─ braze/                     # workspace-as-code: attribute/event dictionary, catalog CSVs, segment specs
├─ scripts/                   # seed-zara.ts, create-test-user.ts, reset-user.ts, verify-schema.ts
└─ docs/                      # demo runbook per TST loop, QA checklist
```

### How brand separation works
| Layer | Shared | Per brand (`brand.config.js` + `theme/`) |
|---|---|---|
| Tracking | Event names, property shapes, identity logic | `entity` value (`SQ` / `TR`), SDK API key, Banner/Content Card placement IDs |
| Booking logic | State machine, validation, pricing math | Fare families/bundles, ancillary catalogue, seat map layout, currency formatting |
| UI | Component markup + behaviour | Tailwind preset + CSS variables (colours, radius, fonts), logos, imagery, copy |
| Server | Handlers | Airline filter for SerpAPI (`include_airlines`), entity defaults |

Theme tokens come from the brand-asset Drive folder. See §2a. They replace the older `siademo-web/.cursor/design/sia_web.json` values (`#002663` / `#DDB067`), which don't match the live site.

### Deployment
- Two Vercel projects (D9: in the `auzani-ridzwans-projects` team) on one repo (root dirs `apps/sq-web`, `apps/tr-web`) → two domains: **https://sq-demo-seven.vercel.app** (project `sq-demo`) and **https://scoot-demo-pied.vercel.app** (project `scoot-demo`).
- **Different domains is deliberate**: no shared cookies, so cross-site recognition genuinely comes from identity resolution, not a shared browser session — the honest version of the Loop 1 story.
- Server-only env: `SERPAPI_KEY`, `BRAZE_REST_API_KEY`, `BRAZE_REST_URL`, `DEMO_ADMIN_TOKEN`. Client env: `VITE_BRAZE_SDK_KEY`, `VITE_BRAZE_SDK_URL`.
- **Braze workspace (D8):** "[AR]-Demo-Singapore Airlines", SDK endpoint `sdk.iad-03.braze.com`. Both web apps already exist:

  | App | `VITE_BRAZE_SDK_KEY` |
  |---|---|
  | sq-web | `5289a0ce-f873-450c-a1df-1a412ea78a44` |
  | tr-web | `e771b7af-769d-4148-8e8a-9a0a1cc7e67c` |

  Web SDK keys are public by design (they ship in the browser bundle), so they go in each app's `.env.example`. The REST API key and the REST endpoint (`rest.iad-03.braze.com`, confirmed in Phase 0) stay server-only and are never committed.
- **SerpAPI key never ships to the browser** (kept from `siademo-web`). Add response caching (per route+date, ~6h) and **recorded fixtures as fallback** so a quota miss or API outage never breaks a live demo.

---

## 2. Site scope (both sites)

| Area | Requirement | Implementation |
|---|---|---|
| Home | 1 hero banner/carousel | **Braze Banner** placement (`{entity}_home_hero`) with static carousel fallback (React rewrite of Cebu `heroCarousel`) |
| Home | 1 row promo content cards | **Braze Content Cards** filtered by `extras.entity` + `extras.placement=home_row`; static fallback cards |
| Search | Origin fixed SIN; 3 destinations served by **both** SQ and TR (D4) | `PER` Perth, `NRT` Tokyo Narita, `BKK` Bangkok. Same list on both sites. One-way / return, pax count, cabin. See "Destinations" below |
| Search | Real flights via SerpAPI | Server proxy filtered by airline: SQ site → `include_airlines=SQ`; Scoot → `TR` |
| Select | Flight + fare | SQ: Economy Lite / Value / Standard / Flexi, plus Premium Economy and Business tabs, colour-coded with SIA's cabin-class accent colours. Scoot: Economy fare + optional **Fare Bundle**, or the **ScootPlus** cabin (787 only) |
| Ancillaries | Mock, mirroring real options | The full catalogue for each brand, with gating rules, is in §2b |
| Seats | Mock | SQ Economy: **Standard / Forward Zone / Extra Legroom**. SQ Premium Economy: **Standard / Extra Legroom / Solo**. Which seats are free depends on the fare and KrisFlyer tier (§2b). Scoot: standard paid seat selection, plus ScootPlus seats on 787s. React rewrite of Cebu `seatMapStep` |
| Payment | Mock | Card form with **published test card numbers only**, simulated 3DS delay, success/fail toggle (lets you demo a payment-failure abandonment) |
| Confirmation | | PNR generated (`SQxxxxx` / `TRxxxxx`), triggers booking events + catalog write |
| Account | Register / login | Email + name + optional KrisFlyer number; consent captured at sign-up per entity |
| Account | Manage preferences & consent | Profile prefs (meal, seat), **Group Preference Centre** (SQ / TR / Kris+ × channel × nature × frequency) |
| Debug | "Braze debug" overlay | See §5 |

### 2a. Brand tokens

Sources: `singaporeair-design-tokens.md` and `scoot-design-tokens.md`, both extracted 2026-11-19. Each app's `theme/` gets a `tokens.json` (copied from the embedded JSON in those files), a Tailwind preset generated from it, and CSS variables. Shared components only use **semantic** variables (`--color-cta-bg`, `--radius-card`, `--font-display`, …), so swapping brands means swapping one file.

| Semantic token | SQ | Scoot |
|---|---|---|
| `--color-page-bg` | `#fafafa` | `#FFFFFF` |
| `--color-surface-alt` | `#e5e9f0` (lightBlue) | `#F2F2F2` |
| `--color-heading` | `#00266b` (siaBlue) | `#1F201E` (near-black) |
| `--color-text` / `--color-text-muted` | `#222222` / `#666666` | `#1F201E` / `#999999` |
| `--color-link` | `#0045c5` | `#1873CD` |
| `--color-cta-bg` / `-hover` / `-text` | `#00266b` / `#003494` / `#fff` | `#FFE900` / `#F1D600` / `#1F201E`. Yellow buttons always use dark text |
| `--color-cta-secondary` | `#2275d3` (hover `#0c62c3`) | `#1F201E` outline |
| `--color-accent` | `#ff9f00`, used **only** for the thin rule under the header and highlights, never on buttons | Pale yellow tints `#FFFBCC` / `#FFFEE6` for highlight banners |
| `--color-success / warning / error` | `#05b410` / `#ff9f00` / `#dc0202` | `#0b750b` / `#eb7100` / `#ca1825` |
| `--font-display` | **Marcellus** (Google Fonts, D10), standing in for SIA's own `sigvar` font: headings, masthead, prices | Montserrat 700 |
| `--font-body` | Proxima Nova, fallback `"Open Sans", Arial` | Montserrat 400 |
| Micro-labels | Uppercase, 12px / 10px, `0.12em` letter-spacing | No uppercase, normal letter-spacing |
| Radius (input / card / button) | 4 / 8 / 4px. Mostly square; 40px pills only for tags | 8 / 24 / 32px (pill). Circles for icons |
| Spacing scale | 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 | Same scale (Bootstrap breakpoints 576 / 768 / 992 / 1200) |
| Hero | Dark, moody cabin photography with a gold light trail. Short aspirational headline, left-aligned | Bright, saturated destination photos with a `rgba(0,0,0,.4)` overlay. Bold 36px playful headline |
| Signature element | Navy everywhere, with one thin orange line | Yellow pill buttons on a near-black and white base |

SQ also gets extra tokens:
- **Cabin-class colours** for fare cards: Economy `#053c2a`→`#1c5d49`, Premium Economy `#495b57`, Business `#053a76`, First `#87220b`, Suites `#866028`.
- **KrisFlyer** gradient `linear-gradient(135deg,#1937cd,#64c8ff)` and tier colours (Elite Silver `#8c9091`, Elite Gold `#8c734b`, PPS `#011e41`). The KrisFlyer card on the account page uses these, on **both** sites, because KrisFlyer is a group-level identity.

Logos (D13): the SIA logo PNGs already in `siademo-web` are reused. The Scoot logo is `logo-scoot-512.png` from your Drive (file ID `1_sUYJq2RboYiwFtJQ5ujKrWSMYAVNyqK`, 48 KB PNG). In Phase 0 it is copied into `apps/tr-web/public/` and used in the header, the favicon and the email template.

### 2b. Ancillary catalogues

Sources: `singaporeair-ancillaries.md` and `scoot-ancillaries.md`. These become `packages/data/ancillaries/{sq,tr}.js`, one record per product:

`product_code, entity, category, name, description, timing (booking_only | post_booking | onboard), cabin_eligibility, fare_eligibility, loyalty_rule, price_sgd, price_basis ('indicative' | 'illustrative'), source_url, confidence`

**Singapore Airlines**

| Code | Product | Gating / pricing in the mock | Confidence |
|---|---|---|---|
| `SQ_SEAT_STD` / `SQ_SEAT_FWD` / `SQ_SEAT_XLEG` | Seat selection (Economy): Standard, Forward Zone, Extra Legroom | Lite: all seats paid. Value/Standard: Standard seats free. Flexi: Standard and Forward Zone free. Extra Legroom always paid. Elite Silver/Gold/PPS: free or discounted. Indicative USD 10–35 / 20–60 / 30–130, converted to SGD by route | Likely |
| `SQ_SEAT_PY_XLEG` / `SQ_SEAT_PY_SOLO` | Premium Economy Extra Legroom; Solo seat (A350-900ULR only) | USD 55–130; Solo USD 168 | Likely |
| `SQ_BAG_KG` | Extra baggage, priced per kg by zone | Prepaid ≥48h before departure: 25% off, up to 45% for PPS. 6–48h before: 10–30% off. The discount shown follows `sia_loyalty.tier` | Certain |
| `SQ_BOOK_THE_COOK` | Book the Cook main-course pre-order | Premium Economy and above, flights over 1.5h, up to 24h before departure. Free | Certain |
| `SQ_SPECIAL_MEAL` | Special meal request | Economy, free | Certain |
| `SQ_INSURANCE` | Travel insurance | In the booking flow. Illustrative price | Certain |
| `SQ_WIFI` | Onboard Wi-Fi | Free on 1 device for logged-in KrisFlyer members; unlimited for Business and above / PPS. Shown as an info badge, not a purchase | Certain |
| `SQ_MYSQUPGRADE` | mySQupgrade: instant cash cabin upgrade | Post-booking, shown in Manage Booking. Used by the Loop 3.B cabin upsell | Likely |
| `SQ_MILES_UPGRADE` | KrisFlyer miles upgrade | Post-booking; needs a KrisFlyer number | Likely |
| `SQ_KRISSHOP` | KrisShop duty-free pre-order | Post-booking; also on Scoot | Likely |
| Info only | SilverKris Lounge, free Singapore Tour, Pelago 10% off, Kris+ | Not purchasable. Lounge eligibility is unconfirmed, so it is shown as "check eligibility" with no price. Kris+ appears as a cross-entity offer | Guessing / Certain |

**Scoot**

| Code | Product | Gating / pricing in the mock | Confidence |
|---|---|---|---|
| `TR_BUNDLE` | Fare Bundle (baggage + seat + flexibility) | **Booking time only.** The real bundle names aren't in the source file, so the mock uses one generic bundle (D12: one generic bundle) | Certain |
| `TR_FLEX` | Flexible Tickets: unlimited changes or refundable fare | Booking time only | Certain |
| `TR_CANCEL` | Cancel Your Trip | At booking, or in Manage Booking up to 24h after booking | Certain |
| `TR_BAG` | Checked baggage | Pre-purchase | Certain |
| `TR_SEAT` | Seat selection | Paid, a-la-carte | Certain |
| `TR_MEAL` | Scoot Café meal pre-order | Same single tier across cabins | Certain |
| `TR_SCOOTSURANCE` | Scootsurance travel insurance | In the booking flow | Certain |
| `TR_BOARDMEFIRST` | BoardMeFirst: early check-in and priority boarding | Economy, standalone | Certain |
| `TR_SCOOTPLUS` | ScootPlus cabin: 38" pitch, 15kg cabin + 30kg checked baggage, priority, 200MB Wi-Fi | 787 only. At booking, via Manage Booking, or by **bid**. Drives the Loop 1 "upgrade offer" | Certain |
| `TR_WIFI` | Wi-Fi plan | 787 only | Certain |
| `TR_KRISSHOP`, `TR_SNOOZE_KIT`, `TR_MERCH` | KrisShop, Snooze Kit, merchandise | Onboard / pre-departure. Snooze Kit and merchandise contents are guessed | Certain / Guessing |

**Pricing.** The Scoot file says no prices are published and asks not to invent any. But a mock checkout needs totals. So:
- SQ uses the midpoint of the indicative bands.
- Scoot gets clearly labelled **illustrative** SGD prices (`price_basis:'illustrative'`), with a small "Demo prices – see Scoot Fees Chart" note on the page.
- Decided (D11): illustrative prices.

**Brand contrast to use in the demo.** Scoot has no Book the Cook, no lounge, and no tier-gated discounts. SQ prices change with KrisFlyer tier. When a logged-in Elite Gold member sees "Forward Zone: free" on SQ but flat prices on Scoot, it shows `sia_loyalty` personalising the site in real time.

**Message moments.** The source files suggest these groupings. They feed the `sia_ancillary_offers` catalog and the 3.B Canvas branches:

| Moment | SQ | Scoot |
|---|---|---|
| At booking | Seat, baggage, insurance | Fare Bundle, Flexible Tickets, Cancel Your Trip |
| After booking, before check-in | Seat, baggage, Book the Cook / meal, insurance, mySQupgrade | Baggage, seat, meal, Scootsurance, BoardMeFirst, ScootPlus bid |
| 24–48h before departure | Last-minute baggage, Book the Cook deadline, Wi-Fi reminder | Wi-Fi (787), KrisShop, Snooze Kit |
| Loyalty trigger | Tier-based free seat or bigger baggage discount | n/a: drives cross-sell to SQ / KrisFlyer instead |

**Destinations (D4/D5).** London is dropped because Scoot doesn't fly it. The proposed list uses only routes where **both** airlines fly from Changi often, so SerpAPI returns real results on both sites:

| Code | City | Why |
|---|---|---|
| `PER` | Perth | Keeps the Zara Loop 1 story (SIN–PER) unchanged. SQ and TR both fly it nonstop, several times a day |
| `NRT` | Tokyo (Narita) | Covers "Japan". SQ flies nonstop; TR serves Narita (some flights stop in Taipei or Bangkok). Fallback if TR results are thin: `KIX` Osaka |
| `BKK` | Bangkok | The busiest SIN route for both airlines (many flights a day each), so it is the safest live-demo route. Alternative short-haul: `SYD` Sydney |

**To confirm in Phase 0:** a small spike runs SerpAPI with `include_airlines=SQ` and then `=TR` for each route, for dates 2, 4 and 8 weeks out. A route is kept only if both airlines return at least 3 itineraries; otherwise the fallback replaces it. The successful responses are saved as fixtures.

**Kris+ (D6, decided):** entity only, with no website. It appears in the preference centre, in `sia_consent` and in `sia_ancillary_offers`. Its Loop 1 step 5 ("skincare picks before departure") is a Braze message (push, email or Content Card).

---

## 3. Identity design (Loop 1)

| Identifier | Where | Purpose |
|---|---|---|
| Braze anonymous user / device ID | SDK, per domain | Pre-login browsing on each site |
| **`external_id` = CEID** | `changeUser()` on both sites | The one group customer ID (stands in for the Hightouch-produced CEID) |
| User alias `sq_customer_id` / `tr_customer_id` | Set via SDK `addAlias` on each site | Shows entity-level identifiers attached to one profile |
| `krisflyer_number` (custom attribute + alias `krisflyer`) | Registration / profile | The "authoritative identifier" from RFP 12.1.1(a)(ix) |
| `sia_registered_entities` (array) | `addToCustomAttributeArray` on register/login per site | Which brands this profile holds accounts with |

**CEID derivation (D3, decided):** `ceid_` + the first 16 hex characters of SHA-256(lowercased email). The same person registering on SQ and on Scoot lands on the *same* profile, with no backend lookup and no raw email in `external_id` (the current `siademo-web` uses the email itself). A mock Hightouch-style `/api/identity/resolve` can be added later for the POC.

**Anonymous → known:** Braze merges anonymous data into a profile only when `changeUser` creates a *new* external ID; logging into an *existing* profile orphans the anonymous data. Two options, both demo-able:
1. Keep pre-login searches on a "pending" queue and re-log them after `changeUser` (simple, client-side).
2. Call `/users/merge` server-side (anonymous `braze_id` → CEID) — directly illustrates identity merging for the Backend Demo beat. **[Recommended for Loop 1; verify endpoint behaviour for anonymous sources in the build.]**

**Cross-site hand-off (optional, Phase 6):** a retargeting message's link to Scoot carries a short-lived signed token (not PII, not the CEID) that `/api/identity/handoff` exchanges for the CEID, so Zara lands on Scoot already recognised.

---

## 4. Event tracking design

Principles (from the Demo Data "One Profile, Multiple Business Units" rule):
- **Every event carries `entity`** (`SQ` | `TR` | `KRISPLUS`). One event name across brands — never `scoot_searched_flight`.
- `sia_` prefix, snake_case, **no PII in properties**, dates as ISO datetimes.
- Names in **bold** are defined in the Demo Data tab; the rest are proposed funnel additions for UC7 abandonment.

### 4.1 Custom events

| Event | Fired when | Key properties | Supports |
|---|---|---|---|
| **`sia_searched_flight`** | Search submitted | **`entity`** (proposed addition — this plan adopts it), `origin`, `origin_code`, `destination`, `destination_code`, `depart_date`, `return_date`, `trip_type`, + `cabin_class`, `pax_count` | Loop 1 entry, Cross-Entity Searchers segment |
| `sia_selected_flight` | Fare chosen | `entity`, `destination_code`, `depart_date`, `flight_number`, `fare_family`, `cabin_class`, `fare_amount`, `currency` | UC7 drop-off depth |
| `sia_booking_step_viewed` | Each booking step entered | `entity`, `step` (`passenger`/`ancillaries`/`seats`/`payment`), `destination_code` | Funnel / drop-off branching |
| `sia_selected_ancillary` | Ancillary added | `entity`, `product_code` (§2b codes), `category` (`seat`/`baggage`/`meal`/`insurance`/`flex`/`upgrade`/`priority`/`wifi`/`retail`), `timing`, `price`, `loyalty_discount_applied` | 3.B ancillary content |
| `sia_selected_seat` | Seat chosen | `entity`, `seat_type` (`standard`/`forward_zone`/`extra_legroom`/`solo`/`scootplus`), `seat_number`, `price`, `free_by_rule` (`fare`/`tier`/none) | `sia_preference_seats` |
| `sia_upgrade_requested` | mySQupgrade, miles upgrade, or ScootPlus bid in Manage Booking | `entity`, `pnr`, `upgrade_type` (`mysqupgrade`/`miles`/`scootplus_bid`), `from_cabin`, `to_cabin`, `amount` | Loop 1 step 3 upgrade offer, 3.B upsell conversion |
| `sia_payment_failed` | Mock payment declined | `entity`, `reason`, `fare_amount` | Payment-drop retargeting |
| **`sia_booking_confirmed`** | Payment success | `entity`, `pnr`, `destination_code`, `cabin_class`, `depart_date`, `fare_paid` (+ `origin_code`, `return_date`, `ancillaries_purchased`) | Loop 1 Canvas **exit**, Loop 3.B entry |
| **`sia_checkin_completed`** | "Manage booking → Check in" button | `entity`, `pnr` | 3.B branch |
| **`sia_consent_updated`** | Preference centre save (one event per changed item) | `entity`, `channel`, `communication_nature`, `new_status`, `source_system` (`preference_center` / `registration` / `MKTDH`) | Loop 2 audit + Canvas trigger |
| `sia_registration_completed` | Sign-up | `entity`, `has_krisflyer`, `registration_source` | Replaces `Registration - Completed` **[verify nothing live depends on old name]** |
| `sia_page_viewed` | Route change | `entity`, `page` | On by default (D7). Uses React Router route names |
| **`sia_trip_completed`**, **`sia_loyalty_tier_changed`** | Not site actions | — | Fired by seed / presenter panel via REST |

No explicit "abandoned" event: abandonment is modelled in Braze as *performed `sia_searched_flight` and did not perform `sia_booking_confirmed` within N hours* — that is the real-time, no-list-pull story Loop 1 tells.

**Purchases:** also `logPurchase` on confirmation (`product_id` = `{entity}_{destination_code}_{fare_family}`, `SGD`, price) so Report Builder / Conversions Dashboard show native revenue for the Section 8 uplift close.

### 4.2 Attributes written by the sites

| Attribute | Written by | When |
|---|---|---|
| Standard: email, first/last name, phone, `email_subscribe` | SDK | Registration / profile edit |
| **`sia_last_search_origin/destination/depart/return`** | SDK | Each search |
| **`sia_registered_entities`** | SDK array add | Register / first login per site |
| `krisflyer_number` | SDK | Registration / profile |
| **`sia_preference_meals`, `sia_preference_seats`** | SDK | Profile page; seat step |
| **`sia_next_trip`** (object) | REST `/users/track` (nested object) | Booking confirmed (soonest upcoming trip) |
| **`sia_consent`** (array of objects) | REST `/users/track` with `$update` + `_merge_objects`, keyed by `id` = `{entity}_{channel}_{nature}` | Preference centre save / registration |
| **`sia_loyalty`**, **`sia_experiment_group`**, `sia_channel_affinity` | Seed script / presenter panel only | Demo setup |

Nested/array-of-objects attributes go **server-side via REST**, not the SDK — consistent with the Loop 2 narrative ("the preference centre's backend calls the Braze REST API") and avoids SDK nested-attribute edge cases.

### 4.3 Catalogs
- **`sia_bookings`** — server writes one item per confirmed booking (`pnr` as ID, `external_id`, `entity`, …) via `/catalogs/sia_bookings/items`. Powers "Booked on Both SQ and Scoot".
- **`sia_ancillary_offers`** — a CSV in `braze/`, generated from the same `packages/data/ancillaries` records the sites use, so the offer in a message always matches the product on the site. `offer_type` values come from the §2b codes, e.g. `mysqupgrade`, `scootplus_upgrade`, `book_the_cook`, `boardmefirst`, `kris_plus_voucher`. Read with Connected Content / Catalog Liquid in 3.B messages.

### 4.4 Consent model (Loop 2, both "Show" variants)
1. **Native Preference Center (Show 1):** subscription groups per entity × channel × nature (e.g. *Scoot Promotions – Email*, *Scoot Flight-Status Alerts – Email*, *SQ Flight-Status – Email*). Sites also set them at registration via SDK `addToSubscriptionGroup`.
2. **Custom Group Preference Centre (Show 2):** shared `ui/preference-centre` page on both sites, matrix of SQ / Scoot / Kris+ × channel × nature × frequency → `/api/consent` → `sia_consent` `$update` + `sia_consent_updated` event + matching subscription-group change, so both enforcement mechanisms stay consistent.
3. Optional: "Restrict processing" (Right to Object) sets all `sia_consent` to `opted_out` + `sia_processing_restricted=true`. **Right to Erasure is described, not clicked live** (`/users/delete` is irreversible).

Starting communication natures: `flight_status`, `news`, `promotions` (+ `offers` for Kris+). These are the build defaults; the final list is an SIA discovery question.

---

## 5. "Braze debug" overlay

A shared `<BrazeDebug />` React drawer, toggled by `?debug=true` or `Shift+D`, presenter-friendly (large type, dockable right/bottom).

| Tab | Shows | Source |
|---|---|---|
| Identity | entity, anonymous vs identified, CEID, device ID, aliases, KrisFlyer #, `sia_registered_entities` | SDK + local state |
| Profile (live) | Attributes incl. `sia_consent` matrix, `sia_next_trip`, `sia_loyalty`; last-refreshed timestamp, auto-refresh after each tracked call | `/api/braze/user-data` → `/users/export/ids` (rewritten in TS) |
| Events | Live stream of events/attributes this session with payloads, + recent events from export | `BrazeManager` `EVENT_LOGGED` bus |
| Messaging | Content Cards & Banners received, IAMs triggered | SDK subscriptions |
| Presenter | Load **Zara** persona, reset demo user, fire `sia_trip_completed` / `sia_loyalty_tier_changed`, flush SDK | Admin API (guarded by `DEMO_ADMIN_TOKEN`) |

Highlight-on-change (attribute flashes when it updates) makes "profile built in real time" visible from the audience's seats.

---

## 6. Braze workspace setup (same workspace, two web apps)
- Workspace "[AR]-Demo-Singapore Airlines" with the two existing web apps (keys in §1). App-level filters let a segment say "last used Scoot Web".
- **Test user (D8):** during build testing, `scripts/create-test-user.ts` registers a test user on each site through the real UI flow. It uses a generated test email recorded in `.env.test.local` (not committed) and an `external_id` prefixed `ceid_test_`. Zara stays the scripted demo persona, and the test user never overlaps with her. `reset-user.ts` cleans up only `ceid_test_` users.
- Subscription groups (§4.4), catalogs (§4.3), Banner placements `sq_home_hero` / `tr_home_hero`, Content Card templates with `entity` + `placement` key-values.
- Seed **Zara** per the Demo Data tab (incl. the earlier SQ booking `SQ91045` and a Scoot search to close the **[NEEDS INPUT]** gap for the Cross-Entity Searchers segment).
- Reference Canvases for rehearsal: Loop 1 retargeting (SQ search → Scoot IAM/email → exit on `sia_booking_confirmed` with `entity=TR` → Kris+ post-booking branch), Loop 2 consent-aware send.
- `braze/schema.json` is the single source for event/attribute names; `scripts/verify-schema.mjs` fails CI if code logs a name not in it.

---

## 7. Build phases

| Phase | Output | Est. |
|---|---|---|
| **0. Setup & spikes** | pnpm + Turborepo scaffold, TS/ESLint/Tailwind presets, 2 Vercel projects, env vars, Scoot logo into `tr-web`, **SerpAPI destination spike** (D4), REST endpoint check | 1 d |
| **1. Core packages** | Rewrite managers in TS, Zod schemas, typed event catalog + schema check, booking store and rules, SerpAPI proxy with cache + fixtures, REST proxy, `BrazeProvider` + hooks, debug overlay v1 | 3 d |
| **2. SQ site** | Theme from the §2a tokens (Marcellus / Proxima Nova), shell, home (Banner + Content Cards), search → results (cabin-coloured fare cards) → passengers → ancillaries (fare and tier gating rules) → seats → payment → confirmation; Manage Booking with mySQupgrade | 3 d |
| **3. Scoot site** | Theme from the §2a tokens, Fare Bundle / ScootPlus selection, booking-time-only add-ons, a-la-carte ancillaries, seat map, ScootPlus bid in Manage Booking | 1.5 d |
| **4. Identity & consent** | Register/login, CEID, aliases, anon→known merge, profile prefs, Group Preference Centre + `/api/consent`, subscription groups | 2 d |
| **5. Braze config & seed** | Catalogs, placements, cards, test user, seed Zara, reference Canvases for Loops 1–2 | 1 d |
| **6. Demo hardening** | Presenter panel, reset, hand-off token (optional), Vitest + Playwright smoke tests, runbook per TST loop, QA on both domains + mobile width | 1.5 d |

About 13 working days (up from 9–10, because of the React + TypeScript rewrite). Phases 2 and 3 can run in parallel once Phase 1 lands.

**Done when:** Zara can be run end-to-end live — search SIN–PER on SQ (logged in) → leave → Scoot retargeting arrives → book on Scoot → Canvas exits → change Scoot promo consent → send suppressed — with every step visible in the debug overlay on both sites.

---

## 8. Decision log (2026-11-19)

| # | Topic | Decision |
|---|---|---|
| D1 | Repo | New monorepo `sia-group-demo` |
| D2 | Stack | React + TypeScript rewrite (§1) |
| D3 | CEID | Hashed-email deterministic ID (§3) |
| D4 | Destinations | **PER, NRT, BKK — validated** by the Phase 0 SerpAPI test (2026-11-19). Both airlines returned real flights on all 3 test dates: PER SQ 4/day, TR 2/day; NRT SQ 2/day, TR 3/day (1 nonstop); BKK SQ 6–7/day, TR 6/day. Pass bar is 2 itineraries per airline per date. KIX rejected (Scoot 1/day); SYD not needed |
| D5 | London | Dropped (covered by D4) |
| D6 | Kris+ | Entity only, no website |
| D7 | `sia_page_viewed` | On by default |
| D8 | Workspace | "[AR]-Demo-Singapore Airlines", `sdk.iad-03.braze.com`, existing SQ/TR web app keys. Create a test user during build testing |
| D9 | Hosting | Vercel, `auzani-ridzwans-projects` |
| D10 | SQ display font | Marcellus (Google Fonts) |
| D11 | Scoot prices | Illustrative, labelled as such |
| D12 | Scoot bundle | One generic "Fare Bundle" |
| D13 | Scoot logo | `logo-scoot-512.png` from Drive |
| D14 | Subscription groups | Six groups in the workspace, synced server-side by `/api/consent` (`v2/subscription/status/set`). A group is subscribed when any mapped topic is opted in: SQ email marketing ← SQ email news + promotions; Scoot email marketing ← TR email news + promotions; Kris+ email ← Kris+ email offers; KrisShop email ← KrisShop email offers; SIA Group WhatsApp ← SQ + TR WhatsApp promotions; SIA Group LINE ← SQ + TR LINE promotions |
| D15 | Consent schema extension | Beyond the Demo Data tab: entity `KRISSHOP`, channels `whatsapp` and `line`, five new `sia_consent` topics (16 in total). Existing profiles get new items appended with `$add` the first time they are saved |

**Still needed before the build:** the SerpAPI key and a Braze REST API key for this workspace (with users.track, users.export.ids, users.merge, catalogs and subscription scopes). Both go into Vercel env vars or a local `.env` that you set; I don't handle them in chat.

## 9. Risks / verify during build
- `entity` on `sia_searched_flight` is flagged "SUGGESTED — VERIFY" in the Demo Data tab — this plan assumes it is approved.
- Catalog-based segment filter ("Booked on Both") and nested-path segment depth — verify in the live segment builder (Phase 5).
- SerpAPI coverage for `TR` on the chosen routes and dates. The Phase 0 spike decides the list; fixtures are the fallback.
- Anonymous-profile merge behaviour on `/users/merge` — verify before relying on it live.
- Ancillary entries tagged `Guessing` in the source files (SilverKris Lounge eligibility, Snooze Kit and merchandise contents) are shown as information only, never as confirmed SIA policy. All prices are directional and the pages say so.
- Brand tokens tagged `[Likely]` (imagery style, Scoot semantic roles) are a starting point. Do a visual check against the live sites during Phase 2/3 QA.
