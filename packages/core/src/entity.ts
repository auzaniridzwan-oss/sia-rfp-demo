/**
 * Brand-agnostic core (Braze wrapper, identity, event catalog, booking rules).
 * Phase 0 only defines the shared entity vocabulary; the rest lands in Phase 1.
 */
/**
 * SIA Group business units. SQ and TR run booking sites; Kris+ and KrisShop appear in
 * consent, offers and messaging only (KRISSHOP added for its email subscription group).
 */
export const ENTITIES = ['SQ', 'TR', 'KRISPLUS', 'KRISSHOP'] as const;
export type Entity = (typeof ENTITIES)[number];

/** Entities that run a booking website in this demo (Kris+ is entity-only, decision D6). */
export type WebEntity = Extract<Entity, 'SQ' | 'TR'>;
