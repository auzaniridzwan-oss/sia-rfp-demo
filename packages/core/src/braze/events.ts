import { z } from 'zod';
import { ENTITIES } from '../entity';
import { CHANNELS, COMMUNICATION_NATURES } from '../schemas/consent';

/**
 * Typed custom-event catalog — the single source of truth for event names and property
 * shapes (docs/BUILD_PLAN.md §4.1, aligned with the "Demo Data" tab of the SIA plan).
 *
 * Rules:
 * - Every event carries `entity` (SQ | TR | KRISPLUS). BrazeClient adds the site's entity
 *   automatically; pass it explicitly only when the event is about another entity
 *   (e.g. changing Scoot consent from the SQ site).
 * - snake_case, `sia_` prefix, no PII in properties.
 * - Date-typed properties are `Date` objects so Braze stores them as time properties.
 *
 * `source: 'server'` events are only sent via REST (seed script / presenter panel), never
 * from the browser SDK.
 */

const entity = z.enum(ENTITIES);
const iata = z.string().regex(/^[A-Z]{3}$/);
const cabin = z.enum(['economy', 'premium_economy', 'business', 'scootplus']);
const money = z.number().nonnegative();

export const EVENT_CATALOG = {
  sia_page_viewed: {
    source: 'sdk',
    description: 'Route change (decision D7: on by default).',
    props: z.object({ page: z.string().min(1) }),
  },
  sia_searched_flight: {
    source: 'sdk',
    description: 'Flight search submitted. Loop 1 entry; Cross-Entity Searchers segment.',
    props: z.object({
      origin: z.string(),
      origin_code: iata,
      destination: z.string(),
      destination_code: iata,
      depart_date: z.date(),
      return_date: z.date().optional(),
      trip_type: z.enum(['one_way', 'round_trip']),
      cabin_class: cabin,
      pax_count: z.number().int().positive(),
    }),
  },
  sia_selected_flight: {
    source: 'sdk',
    description: 'Fare chosen on the results page.',
    props: z.object({
      direction: z.enum(['outbound', 'inbound']),
      destination_code: iata,
      depart_date: z.date(),
      flight_number: z.string(),
      fare_family: z.string(),
      cabin_class: cabin,
      fare_amount: money,
      currency: z.literal('SGD'),
    }),
  },
  sia_booking_step_viewed: {
    source: 'sdk',
    description: 'Booking funnel step entered (drop-off branching).',
    props: z.object({
      step: z.enum(['passenger', 'ancillaries', 'seats', 'payment']),
      destination_code: iata,
    }),
  },
  sia_selected_ancillary: {
    source: 'sdk',
    description: 'Ancillary added in the booking flow or Manage Booking.',
    props: z.object({
      product_code: z.string(),
      category: z.enum(['seat', 'baggage', 'meal', 'insurance', 'flex', 'upgrade', 'priority', 'wifi', 'retail', 'bundle']),
      timing: z.enum(['booking_only', 'post_booking', 'onboard']),
      price: money,
      loyalty_discount_applied: z.boolean(),
    }),
  },
  sia_selected_seat: {
    source: 'sdk',
    description: 'Seat chosen.',
    props: z.object({
      seat_type: z.enum(['standard', 'forward_zone', 'extra_legroom', 'solo', 'scootplus']),
      seat_number: z.string(),
      price: money,
      free_by_rule: z.enum(['fare', 'tier', 'cabin', 'none']),
    }),
  },
  sia_upgrade_requested: {
    source: 'sdk',
    description: 'mySQupgrade, miles upgrade or ScootPlus bid.',
    props: z.object({
      pnr: z.string(),
      upgrade_type: z.enum(['mysqupgrade', 'miles', 'scootplus_bid']),
      from_cabin: cabin,
      to_cabin: cabin,
      amount: money,
    }),
  },
  sia_payment_failed: {
    source: 'sdk',
    description: 'Mock payment declined.',
    props: z.object({ reason: z.string(), fare_amount: money }),
  },
  sia_booking_confirmed: {
    source: 'sdk',
    description: 'Payment success. Loop 1 Canvas exit; Loop 3.B entry.',
    props: z.object({
      pnr: z.string(),
      origin_code: iata,
      destination_code: iata,
      cabin_class: cabin,
      depart_date: z.date(),
      return_date: z.date().optional(),
      fare_paid: money,
      ancillaries_purchased: z.string(),
    }),
  },
  sia_checkin_completed: {
    source: 'sdk',
    description: 'Manage Booking → Check in.',
    props: z.object({ pnr: z.string() }),
  },
  sia_consent_updated: {
    source: 'sdk',
    description: 'One event per changed consent item. Loop 2 audit trail and Canvas trigger.',
    props: z.object({
      channel: z.enum(CHANNELS),
      communication_nature: z.enum(COMMUNICATION_NATURES),
      new_status: z.enum(['opted_in', 'opted_out']),
      source_system: z.enum(['preference_center', 'registration', 'MKTDH']),
    }),
  },
  sia_registration_completed: {
    source: 'sdk',
    description: 'Sign-up completed. Replaces the old "Registration - Completed" event.',
    props: z.object({
      has_krisflyer: z.boolean(),
      registration_source: z.string(),
    }),
  },
  sia_app_error: {
    source: 'sdk',
    description: 'Client error surfaced by the logger (message only, no PII).',
    props: z.object({ message: z.string().max(200) }),
  },
  sia_trip_completed: {
    source: 'server',
    description: 'Fired by the seed script / presenter panel.',
    props: z.object({ pnr: z.string(), destination_code: iata }),
  },
  sia_loyalty_tier_changed: {
    source: 'server',
    description: 'Fired by the seed script / presenter panel.',
    props: z.object({ previous_tier: z.string(), new_tier: z.string(), change_date: z.date() }),
  },
} as const satisfies Record<
  string,
  { source: 'sdk' | 'server'; description: string; props: z.ZodObject<z.ZodRawShape> }
>;

export type EventName = keyof typeof EVENT_CATALOG;
export type SdkEventName = {
  [K in EventName]: (typeof EVENT_CATALOG)[K]['source'] extends 'sdk' ? K : never;
}[EventName];

/** Properties a caller passes. `entity` is optional: the client fills in the site's entity. */
export type EventProps<E extends EventName> = z.input<(typeof EVENT_CATALOG)[E]['props']> & {
  entity?: z.infer<typeof entity>;
};

export type ValidationResult =
  | { ok: true; props: Record<string, unknown> }
  | { ok: false; issues: string[] };

/** Validate props against the catalog (strict: unknown keys are rejected) and add entity. */
export function validateEvent(
  name: EventName,
  props: Record<string, unknown>,
  defaultEntity: z.infer<typeof entity>,
): ValidationResult {
  const def = EVENT_CATALOG[name];
  if (!def) return { ok: false, issues: [`Unknown event "${name}"`] };
  const { entity: explicit, ...rest } = props;
  const entityResult = entity.safeParse(explicit ?? defaultEntity);
  const parsed = def.props.strict().safeParse(rest);
  const issues: string[] = [];
  if (!entityResult.success) issues.push(`entity: ${entityResult.error.issues[0]?.message}`);
  if (!parsed.success) {
    for (const i of parsed.error.issues) issues.push(`${i.path.join('.') || '(root)'}: ${i.message}`);
  }
  if (issues.length || !parsed.success || !entityResult.success) return { ok: false, issues };
  return { ok: true, props: { entity: entityResult.data, ...parsed.data } };
}
