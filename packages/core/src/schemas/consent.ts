import { z } from 'zod';
import { ENTITIES } from '../entity';

export const CHANNELS = ['email', 'push', 'sms', 'whatsapp', 'line', 'in_app'] as const;
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
  topic('KRISSHOP', 'email', 'offers', 'KrisShop offers', 'Duty-free deals and new arrivals from KrisShop.', 'weekly'),
  // Messaging apps: chosen per airline (Demo Data rule: anything that can differ by business
  // unit carries an entity), synced to the group-level WhatsApp / LINE subscription groups.
  topic('SQ', 'whatsapp', 'promotions', 'Offers on WhatsApp', 'Fare deals and KrisFlyer offers in WhatsApp.', 'weekly'),
  topic('SQ', 'line', 'promotions', 'Offers on LINE', 'Fare deals and KrisFlyer offers in LINE.', 'weekly'),
  topic('TR', 'whatsapp', 'promotions', 'Promotions on WhatsApp', 'Flash sales in WhatsApp.', 'weekly'),
  topic('TR', 'line', 'promotions', 'Promotions on LINE', 'Flash sales in LINE.', 'weekly'),
];

export const consentTopic = (id: string) => CONSENT_TOPICS.find((t) => t.id === id);

export const CHANNEL_LABEL: Record<ConsentItem['channel'], string> = { email: 'Email', push: 'App', sms: 'SMS', whatsapp: 'WhatsApp', line: 'LINE', in_app: 'In-app' };

/** "A, B and C" */
export const listJoin = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export const ENTITY_LABEL: Record<ConsentItem['entity'], string> = { SQ: 'Singapore Airlines', TR: 'Scoot', KRISPLUS: 'Kris+', KRISSHOP: 'KrisShop' };

/** Item for a topic with the given status. */
export const consentItem = (t: ConsentTopic, status: ConsentItem['status'], frequency = t.defaultFrequency): ConsentItem => ({
  id: t.id,
  entity: t.entity,
  channel: t.channel,
  communication_nature: t.communication_nature,
  status,
  frequency,
});

/**
 * Braze subscription groups in the "[AR]-Demo-Singapore Airlines" workspace (created in the
 * dashboard). A group is subscribed when ANY of its mapped consent topics is opted in, so
 * the native Preference Center (Loop 2, Show 1) and sia_consent (Show 2) never disagree.
 */
export interface SubscriptionGroup {
  id: string;
  name: string;
  topics: string[];
}

export const SUBSCRIPTION_GROUPS: SubscriptionGroup[] = [
  { id: '1ef09b5b-56fa-4bd4-88ab-5ab370e8c77b', name: 'Singapore Airlines (SQ) Email Marketing', topics: ['SQ_email_news', 'SQ_email_promotions'] },
  { id: '9cd0d316-9b89-457d-9cba-c091762200dd', name: 'Scoot (TR) Email Marketing', topics: ['TR_email_news', 'TR_email_promotions'] },
  { id: '1e338b7b-6061-4917-98af-57e9bfee342e', name: 'Kris+ Email Marketing', topics: ['KRISPLUS_email_offers'] },
  { id: 'ae23f202-66ef-47bb-a84f-a3c902e0929c', name: 'SIA Group WhatsApp Marketing', topics: ['SQ_whatsapp_promotions', 'TR_whatsapp_promotions'] },
  { id: '1495907e-6ff7-416f-aa0b-73acd8cefa0c', name: 'SIA Group LINE Marketing', topics: ['SQ_line_promotions', 'TR_line_promotions'] },
  { id: '5d1e2816-c378-4ac8-948f-a3700f096902', name: 'KrisShop Email Marketing', topics: ['KRISSHOP_email_offers'] },
];

/**
 * Desired state for every mapped group touched by `changedIds`, given the full consent
 * state after the change.
 */
export function subscriptionGroupStates(
  consent: Map<string, Pick<ConsentItem, 'status'>>,
  changedIds?: string[],
): { group: SubscriptionGroup; subscribed: boolean }[] {
  return SUBSCRIPTION_GROUPS.filter((g) => g.topics.length && (!changedIds || g.topics.some((t) => changedIds.includes(t)))).map((group) => ({
    group,
    subscribed: group.topics.some((t) => consent.get(t)?.status === 'opted_in'),
  }));
}
