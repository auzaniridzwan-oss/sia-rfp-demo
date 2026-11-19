import { z } from 'zod';
import { ENTITIES } from '../entity';

export const CHANNELS = ['email', 'push', 'sms', 'in_app'] as const;
export const COMMUNICATION_NATURES = ['flight_status', 'news', 'promotions', 'offers'] as const;

export const ConsentItem = z.object({
  /** Braze identifier_key for $update/$remove: `{entity}_{channel}_{communication_nature}`. */
  id: z.string(),
  entity: z.enum(ENTITIES),
  channel: z.enum(CHANNELS),
  communication_nature: z.enum(COMMUNICATION_NATURES),
  status: z.enum(['opted_in', 'opted_out']),
  frequency: z.enum(['as_needed', 'daily', 'weekly', 'monthly']),
});
export type ConsentItem = z.infer<typeof ConsentItem>;

export const consentId = (
  entity: ConsentItem['entity'],
  channel: ConsentItem['channel'],
  nature: ConsentItem['communication_nature'],
) => `${entity}_${channel}_${nature}`;

export interface ConsentTopic {
  id: string;
  entity: ConsentItem['entity'];
  channel: ConsentItem['channel'];
  communication_nature: ConsentItem['communication_nature'];
  label: string;
  description: string;
  defaultFrequency: ConsentItem['frequency'];
  /** Service messages (flight status) are pre-ticked at sign-up; marketing never is. */
  service: boolean;
}

const topic = (
  entity: ConsentItem['entity'],
  channel: ConsentItem['channel'],
  nature: ConsentItem['communication_nature'],
  label: string,
  description: string,
  defaultFrequency: ConsentItem['frequency'],
): ConsentTopic => ({ id: consentId(entity, channel, nature), entity, channel, communication_nature: nature, label, description, defaultFrequency, service: nature === 'flight_status' });

/**
 * Every consent item a profile carries in `sia_consent` (Demo Data tab, Section 7):
 * entity × channel × communication nature, each with its own status and frequency.
 * The full list is written once (at registration or first save) so later changes are
 * always a single-item `$update` keyed by `id` — the Loop 2 "Show 2" mechanic.
 */
export const CONSENT_TOPICS: ConsentTopic[] = [
  topic('SQ', 'email', 'flight_status', 'Flight status alerts', 'Gate changes, delays and check-in reminders.', 'as_needed'),
  topic('SQ', 'push', 'flight_status', 'Flight status (app)', 'Real-time updates on your phone.', 'as_needed'),
  topic('SQ', 'email', 'news', 'News and stories', 'Destinations, new routes and SIA news.', 'monthly'),
  topic('SQ', 'email', 'promotions', 'Fares and promotions', 'Sales, fare deals and KrisFlyer offers.', 'weekly'),
  topic('TR', 'email', 'flight_status', 'Flight status alerts', 'Gate changes, delays and check-in reminders.', 'as_needed'),
  topic('TR', 'sms', 'flight_status', 'Flight status (SMS)', 'Text alerts on the day of travel.', 'as_needed'),
  topic('TR', 'email', 'news', 'News', 'New routes and Scoot news.', 'monthly'),
  topic('TR', 'email', 'promotions', 'Promotions', 'Sales and fare deals (non-flight offers included).', 'weekly'),
  topic('TR', 'push', 'promotions', 'Promotions (app)', 'Flash sales on your phone.', 'weekly'),
  topic('KRISPLUS', 'push', 'offers', 'Kris+ offers (app)', 'Deals and cashback from Kris+ partners.', 'as_needed'),
  topic('KRISPLUS', 'email', 'offers', 'Kris+ offers', 'A digest of Kris+ partner deals.', 'weekly'),
];

export const consentTopic = (id: string) => CONSENT_TOPICS.find((t) => t.id === id);

export const ENTITY_LABEL: Record<ConsentItem['entity'], string> = { SQ: 'Singapore Airlines', TR: 'Scoot', KRISPLUS: 'Kris+' };

/** Item for a topic with the given status. */
export const consentItem = (t: ConsentTopic, status: ConsentItem['status'], frequency = t.defaultFrequency): ConsentItem => ({
  id: t.id,
  entity: t.entity,
  channel: t.channel,
  communication_nature: t.communication_nature,
  status,
  frequency,
});
