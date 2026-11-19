import { ANONYMOUS_ALIAS_LABEL, CONSENT_TOPICS, ConsentItem, consentItem, isCeid, subscriptionGroupStates } from '@sia/core';
import { z } from 'zod';
import { BrazeRestError, brazeRequest, brazeRestConfig, exportUser, trackUsers } from './braze-rest';
import type { HandlerContext } from './handlers';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const restError = (e: unknown) => (e instanceof BrazeRestError ? { error: 'Braze REST error', status: e.status, detail: e.body.slice(0, 300) } : { error: String(e) });

// ---------------------------------------------------------------- consent

export const ConsentWrite = z.object({
  external_id: z.string().refine(isCeid, 'external_id must be a demo CEID'),
  items: z.array(ConsentItem).min(1).max(CONSENT_TOPICS.length),
  source_system: z.enum(['preference_center', 'registration']),
  /** Right to Object: restrict processing for marketing (all marketing items opted out). */
  restrict_processing: z.boolean().optional(),
});

/**
 * POST /api/consent — the Group Preference Centre's backend (Loop 2, Show 2).
 *
 * - First write for a profile: sets the FULL sia_consent array (every topic; anything not
 *   chosen is opted_out), so later saves can address one item by id.
 * - Later writes: `$update` per changed item keyed by `id`, with `_merge_objects: true`.
 * - Logs one `sia_consent_updated` event per item whose status changed, in the same
 *   /users/track call, so the audit trail and the attribute change land together.
 * - Sets the matching native Braze subscription groups (v2/subscription/status/set), so the
 *   built-in Preference Center (Loop 2, Show 1) always agrees with sia_consent.
 */
export async function handleConsent(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const parsed = ConsentWrite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid consent payload', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
  const cfg = brazeRestConfig(ctx.env ?? process.env);
  if (!cfg) return json({ error: 'Braze REST is not configured on this deployment' }, 503);
  const { external_id, items, source_system, restrict_processing } = parsed.data;

  let existing: ConsentItem[] | null = null;
  try {
    const user = await exportUser(cfg, external_id);
    const raw = (user?.custom_attributes as { sia_consent?: unknown } | undefined)?.sia_consent;
    existing = Array.isArray(raw) ? (raw as ConsentItem[]) : null;
  } catch (e) {
    return json(restError(e), 502);
  }

  const before = new Map((existing ?? []).map((i) => [i.id, i.status]));
  const changed = items.filter((i) => before.get(i.id) !== i.status);
  const now = new Date().toISOString();
  const events = changed.map((i) => ({
    external_id,
    name: 'sia_consent_updated',
    time: now,
    properties: { entity: i.entity, channel: i.channel, communication_nature: i.communication_nature, new_status: i.status, source_system },
  }));

  let consentAttr: Record<string, unknown>;
  let mode: 'initialised' | 'updated';
  if (!existing) {
    const chosen = new Map(items.map((i) => [i.id, i]));
    consentAttr = { sia_consent: CONSENT_TOPICS.map((t) => chosen.get(t.id) ?? consentItem(t, 'opted_out')) };
    mode = 'initialised';
  } else {
    const known = new Set(existing.map((i) => i.id));
    const updates = items.filter((i) => known.has(i.id));
    const additions = items.filter((i) => !known.has(i.id));
    consentAttr = {
      sia_consent: {
        ...(updates.length ? { $update: updates.map(({ id, ...rest }) => ({ $identifier_key: 'id', $identifier_value: id, $new_object: rest })) } : {}),
        ...(additions.length ? { $add: additions } : {}),
      },
    };
    mode = 'updated';
  }

  try {
    await trackUsers(cfg, {
      attributes: [
        {
          external_id,
          _merge_objects: true,
          ...consentAttr,
          ...(restrict_processing !== undefined ? { sia_processing_restricted: restrict_processing } : {}),
        },
      ],
      ...(events.length ? { events } : {}),
    });
  } catch (e) {
    return json(restError(e), 502);
  }
  // Native subscription groups: state from the full consent after this change.
  const after = new Map<string, ConsentItem>(
    (existing ?? CONSENT_TOPICS.map((t) => consentItem(t, 'opted_out'))).map((i) => [i.id, i]),
  );
  for (const i of items) after.set(i.id, i);
  const groups = subscriptionGroupStates(after, mode === 'initialised' ? undefined : items.map((i) => i.id));
  let subscription_groups: string[] | string = [];
  if (groups.length) {
    try {
      await brazeRequest(cfg, '/v2/subscription/status/set', {
        subscription_groups: groups.map(({ group, subscribed }) => ({
          subscription_group_id: group.id,
          subscription_state: subscribed ? 'subscribed' : 'unsubscribed',
          external_ids: [external_id],
        })),
      });
      subscription_groups = groups.map(({ group, subscribed }) => `${group.name}: ${subscribed ? 'subscribed' : 'unsubscribed'}`);
    } catch (e) {
      subscription_groups = `failed (${e instanceof BrazeRestError ? e.status : 'error'})`;
    }
  }

  return json({ ok: true, mode, items_written: items.length, events_logged: events.length, changed: changed.map((i) => `${i.id}=${i.status}`), subscription_groups });
}

// ---------------------------------------------------------------- merge

export const MergeRequest = z.object({
  external_id: z.string().refine(isCeid, 'external_id must be a demo CEID'),
  anonymous_alias: z.string().regex(/^(SQ|TR)-[\w-]{6,64}$/),
});

/**
 * POST /api/identity/merge — fold an anonymous visitor's profile (found by its
 * `sia_web_anonymous` alias) into the CEID profile they just logged in to. Braze only
 * auto-merges anonymous data when changeUser creates a NEW profile; for an existing one
 * the anonymous activity would otherwise be orphaned.
 */
export async function handleMerge(request: Request, ctx: HandlerContext): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const parsed = MergeRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Invalid merge payload', issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }, 400);
  const cfg = brazeRestConfig(ctx.env ?? process.env);
  if (!cfg) return json({ error: 'Braze REST is not configured on this deployment' }, 503);
  const { external_id, anonymous_alias } = parsed.data;
  try {
    const out = await brazeRequest(cfg, '/users/merge', {
      merge_updates: [
        {
          identifier_to_merge: { user_alias: { alias_name: anonymous_alias, alias_label: ANONYMOUS_ALIAS_LABEL } },
          identifier_to_keep: { external_id },
        },
      ],
    });
    return json({ ok: true, braze: out });
  } catch (e) {
    return json(restError(e), 502);
  }
}
