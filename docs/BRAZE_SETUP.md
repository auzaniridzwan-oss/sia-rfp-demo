# Braze workspace setup — SIA Group demo

Workspace **"[AR]-Demo-Singapore Airlines"** (`sdk.iad-03.braze.com` / `rest.iad-03.braze.com`).

## 1. Done by script (re-runnable)

| Command | What it does |
|---|---|
| `pnpm braze:setup` | Creates catalogs `sia_bookings` (13 fields) and `sia_ancillary_offers` (9 fields), and upserts 19 offers generated from `packages/data/ancillaries` plus 4 Kris+ partner offers |
| `pnpm seed:zara` | Seeds the Zara persona (start of the live demo). Re-run it to reset Zara after a rehearsal |

**Zara after seeding** — `zara.tan@example.com` → `ceid_test_f12e531e78c51b24`. Set `DEMO_PERSONA_EMAIL` to a plus-address of your own inbox if you want to receive the demo emails.

| Data | Value |
|---|---|
| Aliases | `sq_customer_id`, `tr_customer_id`, `krisflyer` (8812340001) |
| `sia_loyalty` | Blue · 24,850 miles · expiring 2026-12-05 · last activity 2026-08-20 · `lapsing` |
| `sia_registered_entities` | SQ, TR |
| Events | SQ search SIN–PER (just now), Scoot search SIN–PER (5 days ago), past `sia_booking_confirmed` + `sia_trip_completed` for SQ91045 |
| Catalog | `sia_bookings` SQ91045 (SIN–NRT, completed) |
| `sia_consent` (16 items) | On: SQ email flight status, SQ email news, Scoot email flight status, Scoot email promotions, Kris+ push offers. Everything else off |
| Subscription groups | SQ email marketing ✓, Scoot email marketing ✓, the other four ✗ |
| `sia_next_trip` | none (created live when she books Scoot in Loop 1) |

What the seed does **not** reset: Scoot bookings Zara makes during a rehearsal stay in `sia_bookings`, and browser state stays in each site. To reset the browser, log out on both sites, or add `?debug=true` and clear the site data.

## 2. Dashboard steps (no API for these)

### 2.1 Banner placements
**Settings → Banners → Create placement** (exact IDs, the sites request these):

| Placement ID | Site | Slot |
|---|---|---|
| `sq_home_hero` | SQ | Home hero (replaces the carousel when a Banner is live) |
| `tr_home_hero` | Scoot | Home hero |

Design the Banner at roughly 1200×420, with the headline on the left. Once a Banner campaign targets a user, the site swaps it in on the next page load.

### 2.2 Content Cards (home promo row)
Create Content Card campaigns targeting the **SQ web** or **Scoot web** app, with these key-value pairs:

| Key | Value | Effect |
|---|---|---|
| `entity` | `SQ` or `TR` | Only that site shows the card |
| `placement` | `home_row` | Shows in the "Featured for you" / "Deals worth packing for" row (first 3 cards) |
| `destination` | `PER` / `NRT` / `BKK` (optional) | The card's button pre-fills the search widget |

Use title, description, image and link text (Captioned Image or Classic). Impressions and clicks are logged by the site.

### 2.3 Segments (Demo Data tab)

| Segment | Filters |
|---|---|
| Cross-Entity Searchers, SQ and Scoot | Custom event `sia_searched_flight` **property `entity` = SQ** ≥1 time in last 30 days **AND** the same with `entity` = TR (event property filters must be enabled for `sia_searched_flight.entity`) |
| Booked on Both SQ and Scoot | Catalog filter on `sia_bookings`: item where `external_id` = user's external ID and `entity` = SQ, **AND** one with `entity` = TR. If catalog segment filters aren't available, use a SQL Segment Extension on `sia_booking_confirmed` grouped by `entity` |
| SQ Opted-In, Scoot Opted-Out (Email, News) | Nested custom attribute `sia_consent[]`: item with entity=SQ, channel=email, communication_nature=news, status=opted_in **AND** item with entity=TR, channel=email, communication_nature=news, status=opted_out |
| Lapsing Gold Members | `sia_loyalty.tier` = Gold AND `sia_loyalty.last_activity_date` more than 60 days ago |
| Miles Expiring in 30 Days | `sia_loyalty.miles_expiry` in the next 30 days *(Zara qualifies)* |
| Upcoming SQ Business Trip | `sia_next_trip.entity` = SQ AND `cabin_class` = business AND `depart_date` in next 7 days AND `checkin_status` ≠ completed |

Mark `sia_consent`, `sia_loyalty` and `sia_next_trip` as nested custom attributes, and add their schemas (Data Settings → Custom Attributes), so they appear in the segment builder.

### 2.4 Canvas — Loop 1: cross-entity retargeting

1. **Entry:** action-based, custom event `sia_searched_flight` where property `entity` = `SQ`. Re-eligibility after 1 day.
2. **Audience:** Zara-style test users, `email_subscribe` ≠ unsubscribed, member of the **Scoot (TR) Email Marketing** subscription group (UC7 AC2, consent filtering).
3. **Action Paths** (wait up to 2 minutes for the demo; 24 hours in the real story):
   - performs `sia_booking_confirmed` → exit (already converted)
   - everyone else → step 4
4. **Message (Scoot):** an in-app message on the **Scoot web** app (trigger: start session), plus an email from the Scoot group. Live fare via Connected Content against the Scoot site:
   ```liquid
   {% connected_content https://scoot-demo-pied.vercel.app/api/flights?from=SIN&to={{custom_attribute.${sia_last_search_destination}}}&date={{custom_attribute.${sia_last_search_depart} | date: '%Y-%m-%d'}} :save fares %}
   {% assign best = fares.itineraries | first %}
   Fly Scoot to Perth from SGD {{ best.basePriceSgd }} — upgrade to ScootPlus for more legroom.
   ```
5. **Exit criteria:** performs `sia_booking_confirmed` with property `entity` = `TR`. This stops retargeting the moment she books Scoot (the step 4 narrative).
6. **Post-booking branch (Kris+):** a separate step triggered by `sia_booking_confirmed` (entity TR) → delay until 1 day before `sia_next_trip.depart_date` (for the demo, use a 1-minute delay) → push/email/Content Card with the catalog offer:
   ```liquid
   {% catalog_items sia_ancillary_offers KP_{{custom_attribute.${sia_next_trip}.destination_code}}_SKINCARE %}
   {{ items[0].title }} — {{ items[0].description }}
   ```
   (`KP_PER_SKINCARE` exists; for other destinations use `KP_ANY_CASHBACK`.)

### 2.5 Canvas — Loop 2: consent-aware send

1. **Scoot promotional Canvas:** a scheduled or action-based email to the **Scoot (TR) Email Marketing** subscription group.
2. **Live suppression:** when Zara turns off Scoot promotions in the Preference Centre (on either site), `/api/consent` sets the subscription group to *Unsubscribed* in the same request, so the next send step skips her automatically.
3. **Audit / Action Path:** an Action Path on custom event `sia_consent_updated` where `entity` = TR AND `communication_nature` = promotions AND `new_status` = opted_out → exit or route to a "preferences updated" confirmation.
4. **Show 1 (native):** in the email footer, `{% preference_center %}` links to a Braze Preference Center listing the SQ / Scoot / Kris+ / KrisShop email marketing groups. The custom Group Preference Centre (`/preferences`) keeps these same groups in sync.

## 3. Live demo checklist

1. `pnpm seed:zara` (resets Zara).
2. Open both sites with `?debug=true`; log out on both.
3. **Loop 1:** log in as Zara on SQ → search SIN–PER → leave → Scoot IAM/email arrives → log in on Scoot → book → the Canvas exits; the profile shows `sia_next_trip` (TR) and a new `sia_bookings` item.
4. **Loop 2:** Preferences (either site) → turn off Scoot "Promotions" (email) → save → the debug panel shows the `sia_consent` `$update`, `sia_consent_updated` and the subscription group change.
5. **Loop 3.A:** `sia_loyalty` drives the "Miles Expiring in 30 Days" segment. On SQ, Zara's tier changes seat and baggage prices (set the tier to Gold with a REST call to show it live).
