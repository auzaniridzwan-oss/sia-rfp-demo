/**
 * Custom attribute names (docs/BUILD_PLAN.md §4.2). Nested / array-of-object attributes
 * (sia_consent, sia_next_trip, sia_loyalty) are written server-side via REST, never from
 * the SDK, so they are listed separately.
 */
export const SDK_ATTRIBUTES = {
  lastSearchOrigin: 'sia_last_search_origin',
  lastSearchDestination: 'sia_last_search_destination',
  lastSearchDepart: 'sia_last_search_depart',
  lastSearchReturn: 'sia_last_search_return',
  registeredEntities: 'sia_registered_entities',
  krisflyerNumber: 'krisflyer_number',
  preferenceMeals: 'sia_preference_meals',
  preferenceSeats: 'sia_preference_seats',
} as const;

export const REST_ATTRIBUTES = {
  consent: 'sia_consent',
  nextTrip: 'sia_next_trip',
  loyalty: 'sia_loyalty',
  experimentGroup: 'sia_experiment_group',
  channelAffinity: 'sia_channel_affinity',
  processingRestricted: 'sia_processing_restricted',
} as const;

export type SdkAttributeKey = (typeof SDK_ATTRIBUTES)[keyof typeof SDK_ATTRIBUTES];

/** Braze user alias labels per entity (one profile, many entity identifiers). */
export const ALIAS_LABELS = {
  SQ: 'sq_customer_id',
  TR: 'tr_customer_id',
  KRISPLUS: 'krisplus_customer_id',
  krisflyer: 'krisflyer',
} as const;
