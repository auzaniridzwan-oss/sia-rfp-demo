# Live demo runbook — SIA Group (Sections 6–8)

Sites: **SQ** https://sq-demo-seven.vercel.app · **Scoot** https://scoot-demo-pied.vercel.app
Persona: **Zara** — `zara.tan@example.com` (or your `DEMO_PERSONA_EMAIL`) → `ceid_test_f12e531e78c51b24`
Braze workspace setup and Canvas specs: [BRAZE_SETUP.md](BRAZE_SETUP.md)

## Before the session

**About 60 minutes before**
1. `pnpm smoke`: both sites, both APIs, live search, phone layout. This also warms the flight-search cache, so the first search on stage is instant.
2. Reset Zara: run `pnpm seed:zara`, or use **Braze panel → Presenter → Reset Zara** (needs the presenter token, see below).
3. Check the Canvases in BRAZE_SETUP.md §2.4–2.5 are live and use 1–2 minute delays, not 24 hours.

**About 10 minutes before**
1. Open both sites in **separate windows** (they are different domains, so each has its own Braze session).
2. On each one: add `?debug=true`, then **Braze → Presenter → Reset this browser**. Both are now anonymous with the panel open.
3. Keep the Braze dashboard open in a third tab, on Zara's user profile.

**Presenter token:** `DEMO_ADMIN_TOKEN` from the repo `.env`. Paste it once into the Presenter tab on each site; it's remembered in that browser. Production needs the same value in both Vercel projects (`/api/health` shows `"presenter": true` when it's set).

## Panel cheat-sheet (Shift+D)

| Tab | Point at |
|---|---|
| Identity | anonymous → identified, the CEID, aliases (`sq_customer_id`, `tr_customer_id`, `krisflyer`), "Registered with SQ, TR" |
| Events | every event with its `entity`; blue **REST** rows are server writes (`sia_next_trip`, catalog, consent, merge) |
| Profile | live Braze profile; rows **flash amber** when they change (refreshes itself a few seconds after activity) |
| Messaging | Content Cards, Banners and in-app messages received |
| Presenter | reset Zara, set the KrisFlyer tier, complete the trip, reset this browser |

---

## Loop 1 — Cross-entity identity and retargeting (Section 6)

**Story:** Zara searches SQ for Perth and leaves. Scoot wins her back. Kris+ follows up before the trip.

| # | Do | Say / show |
|---|---|---|
| 1 | **SQ:** browse anonymously → search SIN–PER (return, Economy) | Events: `sia_searched_flight` with `entity: SQ` on an anonymous profile |
| 2 | **SQ:** Log in → `zara.tan@example.com` | Events: `changeUser`, then REST `users/merge (anonymous → CEID)`. Her anonymous search is now on her profile. Identity: CEID and aliases |
| 3 | Show results (live Google Flights fares, SQ cabin colours), then **leave** | The "search, no booking" condition starts the Canvas (BRAZE_SETUP §2.4) |
| 4 | **Scoot window:** log in as Zara | Same CEID on a different domain, so one profile. Identity shows `tr_customer_id`. Messaging: the Scoot in-app message with a live fare arrives once the Canvas delay passes |
| 5 | **Scoot:** book SIN–PER → Fare Bundle → seat (free with the bundle) → pay with `4242 4242 4242 4242` | Events: `sia_booking_confirmed` (entity TR) and purchase; REST `sia_next_trip` + `sia_bookings`. The Canvas exits on this event |
| 6 | Braze dashboard → Zara's profile | One profile: SQ search, Scoot booking, both web apps; she's now in the "Booked on Both SQ and Scoot" segment (SQ91045 + the new TR booking) |
| 7 | The Kris+ step fires (1-minute demo delay) | Message with catalog offer `KP_PER_SKINCARE` ("skincare picks for Perth") |

**If something fails:** if live search is slow, the page shows offline data with a note, or a **Try again** button. If the Canvas doesn't fire, show the profile and events and describe the Canvas.

## Loop 2 — Consent update and propagation (Section 7)

**Story:** Zara stops Scoot promotions but keeps SQ flight alerts, in one place, across the group.

| # | Do | Say / show |
|---|---|---|
| 1 | **Either site** → Preferences | One page for SQ, Scoot, Kris+ and KrisShop by email, app, SMS, WhatsApp and LINE, loaded live from `sia_consent` |
| 2 | Turn off **Scoot → Promotions (email)** → Save | Events (REST): `sia_consent` `$update` of the single item `TR_email_promotions`, `sia_consent_updated`, and `v2/subscription/status/set` → Scoot email marketing **Unsubscribed** |
| 3 | Profile tab | `sia_consent` chip `TR_email_promotions` turns grey; SQ flight status stays green |
| 4 | Braze dashboard | The Scoot promo Canvas skips her at the next send (subscription group); the `sia_consent_updated` event is the audit trail |
| 5 | Optional: **Stop all marketing (right to object)** | Every marketing item off plus `sia_processing_restricted = true`; service alerts continue |

**Show 1 (native):** open a Scoot email → footer **Manage preferences** → Braze Preference Center. The same subscription groups, kept in sync with `/preferences`.

## Loop 3.A — Loyalty lifecycle (Section 8)

| # | Do | Say / show |
|---|---|---|
| 1 | Profile tab: `sia_loyalty` | Blue, 24,850 miles, expiring 2026-12-05, `lapsing`. She's in "Miles Expiring in 30 Days" |
| 2 | Presenter → set tier **Silver** (or Gold) | `sia_loyalty.tier` flashes; `sia_loyalty_tier_changed` is logged, which is the tier-change Canvas entry |
| 3 | **SQ:** start a booking → Seats / Extras | Seat and baggage prices change with her tier (Gold: Forward Zone free, Extra Legroom 50% off, bigger baggage discount). Scoot prices don't (no tier pricing) |

## Loop 3.B — Trip and booking lifecycle (Section 8)

| # | Do | Say / show |
|---|---|---|
| 1 | After Loop 1's Scoot booking: Profile → `sia_next_trip` | entity TR, PNR, dates, meal or insurance flags: the data the AI-assisted Canvas personalises on |
| 2 | **Scoot → Manage booking** → Check in, or Bid for ScootPlus | `sia_checkin_completed` / `sia_upgrade_requested`; REST update of `sia_next_trip` |
| 3 | Presenter → **Complete next trip** | `sia_trip_completed`; `sia_next_trip.booking_status = completed`; the catalog item is updated |

## After the session
- Presenter → **Reset Zara**, then **Reset this browser** on both sites.
- Test users created during rehearsals all start with `ceid_test_`.
