/**
 * Customer Enterprise ID (CEID) for the demo (decision D3).
 *
 * Deterministic: the same email always yields the same CEID, so a person who registers on
 * SQ and later on Scoot lands on ONE Braze profile without a lookup service. It stands in
 * for the Hightouch-produced CEID in the real architecture. The raw email never becomes
 * the external_id.
 *
 * Test users (any @example.com / @example.org address) get a `ceid_test_` prefix so
 * scripts can find and clean them up without touching demo personas.
 */
export const TEST_EMAIL = /@example\.(com|org)$/i;

export async function ceidFromEmail(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  const bytes = new TextEncoder().encode(normalised);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${TEST_EMAIL.test(normalised) ? 'ceid_test_' : 'ceid_'}${hex.slice(0, 16)}`;
}

export const isCeid = (id: string) => /^ceid_(test_)?[0-9a-f]{16}$/.test(id);
