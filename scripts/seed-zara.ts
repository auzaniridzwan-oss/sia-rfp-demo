/**
 * Seed the "Zara" demo persona (SIA Presentation Draft → Zara Data tables, Loops 1–3.A).
 * Safe to re-run: every write is an upsert, and consent is re-set for all topics.
 *
 * State after seeding = the START of the live demo:
 *  - KrisFlyer member (Blue, 24,850 miles, miles expiring 2026-12-05, lapsing)
 *  - accounts with SQ and Scoot; one earlier SQ trip (SQ91045 SIN–NRT, completed)
 *  - searched SIN–PER on SQ (Loop 1 entry) and on Scoot in the last 30 days
 *    (closes the Demo Data [NEEDS INPUT] gap for the Cross-Entity Searchers segment)
 *  - consent per Loop 2: SQ flight status + news on, Scoot promotions on (she turns it
 *    off live), Scoot news off, Kris+ push offers on
 *  - NO sia_next_trip: she books Scoot live in Loop 1, which creates it
 *
 * Usage: pnpm seed:zara   (DEMO_PERSONA_EMAIL overrides the default zara.tan@example.com,
 * e.g. a plus-address of your own inbox if you want to receive the demo emails)
 */
import { brazeRestConfig } from '../packages/server/src/braze-rest';
import { seedZara } from '../packages/server/src/seed';

const cfg = brazeRestConfig();
if (!cfg) {
  console.error('BRAZE_REST_API_KEY / BRAZE_REST_URL missing in .env');
  process.exit(1);
}
const result = await seedZara(cfg, process.env.DEMO_PERSONA_EMAIL ?? undefined);
console.log(result.log.join('\n'));
console.log(`\nDone. Log in on either site as ${result.email} (Braze may take ~30s to show everything).`);
