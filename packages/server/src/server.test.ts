import { describe, expect, it } from 'vitest';
import { fixtureResponse } from './serpapi';
import { handleBrazeProfile, handleFlights, handleHealth } from './handlers';
import { maskEmail } from './braze-rest';

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const env = {}; // no keys: forces the offline path

describe('fixtureResponse', () => {
  it('serves Scoot SIN-PER from fixtures, shifted to the requested date, Scoot legs only', () => {
    const date = inDays(30);
    const r = fixtureResponse({ from: 'SIN', to: 'PER', date }, 'TR', 'test')!;
    expect(r.source).toBe('fixture');
    expect(r.itineraries.length).toBeGreaterThanOrEqual(2);
    for (const it of r.itineraries) {
      expect(it.legs[0]!.from.time.startsWith(date)).toBe(true);
      expect(it.legs.every((l) => l.flightNumber.startsWith('TR'))).toBe(true);
    }
  });
  it('mirrors an outbound fixture for the return direction', () => {
    const date = inDays(40);
    const r = fixtureResponse({ from: 'NRT', to: 'SIN', date }, 'SQ', 'test')!;
    expect(r.itineraries.length).toBeGreaterThan(0);
    const it = r.itineraries[0]!;
    expect(it.legs[0]!.from.code).toBe('NRT');
    expect(it.legs[it.legs.length - 1]!.to.code).toBe('SIN');
    expect(r.note).toMatch(/approximate/);
  });
});

describe('handleFlights', () => {
  const call = (qs: string, entity: 'SQ' | 'TR' = 'SQ') => handleFlights(new Request(`http://x/api/flights?${qs}`), { entity, env });
  it('rejects routes outside the demo', async () => {
    expect((await call(`from=SIN&to=LHR&date=${inDays(10)}`)).status).toBe(400);
    expect((await call(`from=PER&to=NRT&date=${inDays(10)}`)).status).toBe(400);
  });
  it('rejects past dates and bad input', async () => {
    expect((await call(`from=SIN&to=PER&date=2020-01-01`)).status).toBe(400);
    expect((await call(`from=SIN&to=PER&date=tomorrow`)).status).toBe(400);
  });
  it('falls back to fixtures without a SerpAPI key', async () => {
    const res = await call(`from=SIN&to=BKK&date=${inDays(14)}`, 'TR');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { source: string; airline: string; itineraries: unknown[] };
    expect(body).toMatchObject({ source: 'fixture', airline: 'TR' });
    expect(body.itineraries.length).toBeGreaterThan(0);
  });
});

describe('handleBrazeProfile', () => {
  it('only accepts CEIDs', async () => {
    const res = await handleBrazeProfile(new Request('http://x/api/braze/profile?external_id=someone@example.com'), { entity: 'SQ', env });
    expect(res.status).toBe(400);
  });
  it('503 when REST is not configured', async () => {
    const res = await handleBrazeProfile(new Request('http://x/api/braze/profile?external_id=ceid_test_0123456789abcdef'), { entity: 'SQ', env });
    expect(res.status).toBe(503);
  });
});

describe('misc', () => {
  it('health never leaks values', async () => {
    const body = await handleHealth(new Request('http://x/api/health'), { entity: 'TR', env: { SERPAPI_KEY: 'secret' } }).json();
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(body).toMatchObject({ entity: 'TR', serpapi: true, brazeRest: false });
  });
  it('maskEmail', () => expect(maskEmail('zara@example.com')).toBe('z***@example.com'));
});

describe('consent + merge validation', async () => {
  const { handleConsent, handleMerge } = await import('./consent');
  const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  it('rejects non-CEID ids and malformed items', async () => {
    expect((await handleConsent(post({ external_id: 'zara@example.com', items: [], source_system: 'preference_center' }), { entity: 'SQ', env })).status).toBe(400);
    expect((await handleConsent(post({ external_id: 'ceid_test_0123456789abcdef', items: [{ id: 'x' }], source_system: 'preference_center' }), { entity: 'SQ', env })).status).toBe(400);
  });
  it('503 when REST is not configured', async () => {
    const item = { id: 'TR_email_promotions', entity: 'TR', channel: 'email', communication_nature: 'promotions', status: 'opted_out', frequency: 'weekly' };
    expect((await handleConsent(post({ external_id: 'ceid_test_0123456789abcdef', items: [item], source_system: 'preference_center' }), { entity: 'SQ', env })).status).toBe(503);
  });
  it('merge only accepts site anonymous aliases', async () => {
    expect((await handleMerge(post({ external_id: 'ceid_test_0123456789abcdef', anonymous_alias: 'someone-else' }), { entity: 'SQ', env })).status).toBe(400);
  });
});

describe('admin guard', async () => {
  const { handleAdmin } = await import('./admin');
  const post = (token?: string) =>
    new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'seed_zara' }), headers: { 'content-type': 'application/json', ...(token ? { 'x-demo-admin-token': token } : {}) } });
  it('is disabled without DEMO_ADMIN_TOKEN', async () => {
    expect((await handleAdmin(post('x'), { entity: 'SQ', env: {} })).status).toBe(503);
  });
  it('rejects a wrong or missing token', async () => {
    const e = { DEMO_ADMIN_TOKEN: 'secret-token' };
    expect((await handleAdmin(post(), { entity: 'SQ', env: e })).status).toBe(401);
    expect((await handleAdmin(post('nope'), { entity: 'SQ', env: e })).status).toBe(401);
  });
});
