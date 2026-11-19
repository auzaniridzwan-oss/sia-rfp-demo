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
