import { ceidFromEmail, SDK_ATTRIBUTES, type ConsentItem, type UserProfileInput } from '@sia/core';
import { useBraze, useSia } from '@sia/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAccount } from '../lib';
import { useSite } from '../site';

export interface SignInInput {
  email: string;
  profile?: UserProfileInput;
  krisflyerNumber?: string;
  /** Consent captured at registration (written via /api/consent, source "registration"). */
  consent?: ConsentItem[];
  source: 'login' | 'register';
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Does a Braze profile already exist for this CEID? (null = could not tell) */
export async function lookupProfile(ceid: string): Promise<{ exists: boolean | null; firstName: string | null }> {
  try {
    const res = await fetch(`/api/braze/profile?external_id=${encodeURIComponent(ceid)}`);
    if (!res.ok) return { exists: null, firstName: null };
    const body = (await res.json()) as { found?: boolean; user?: { first_name?: string } };
    return { exists: Boolean(body.found), firstName: body.user?.first_name ?? null };
  } catch {
    return { exists: null, firstName: null };
  }
}

/**
 * Sign-in / registration, shared by both sites (docs/BUILD_PLAN.md §3):
 * 1. CEID from the email (same person → same profile on SQ and Scoot).
 * 2. Flush anonymous SDK data, then changeUser.
 * 3. If the profile already existed, merge the anonymous alias into it (/users/merge),
 *    because Braze only auto-merges anonymous data into NEW profiles.
 * 4. Write registration consent through the preference-centre backend.
 */
export function useSignIn() {
  const braze = useBraze();
  const { entity } = useSia();
  const site = useSite();
  const account = useAccount();
  const queryClient = useQueryClient();

  return useCallback(
    async (input: SignInInput) => {
      const ceid = await ceidFromEmail(input.email);
      const found = await lookupProfile(ceid);
      await braze.flush();
      const anonymousAlias = braze.takeAnonymousAlias();
      braze.identify(ceid, { email: input.email.trim(), ...input.profile });
      if (input.krisflyerNumber) braze.setAttribute(SDK_ATTRIBUTES.krisflyerNumber, input.krisflyerNumber);

      if (found.exists && anonymousAlias) {
        const r = await postJson('/api/identity/merge', { external_id: ceid, anonymous_alias: anonymousAlias });
        braze.noteRest('users/merge (anonymous → CEID)', r.ok ? 'sent' : 'failed', { anonymous_alias: anonymousAlias, external_id: ceid, response: r.body });
      }
      if (input.consent?.length) {
        const r = await postJson('/api/consent', { external_id: ceid, items: input.consent, source_system: 'registration' });
        braze.noteRest('consent (registration): sia_consent + sia_consent_updated', r.ok ? 'sent' : 'failed', r.body);
      }
      if (found.exists === false) {
        braze.track('sia_registration_completed', { has_krisflyer: Boolean(input.krisflyerNumber), registration_source: `${entity.toLowerCase()}_${input.source}` });
      }
      account.remember(input.profile?.firstName ?? found.firstName ?? 'traveller');
      void braze.flush();
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['braze-profile'] }), 3000);
      return { ceid, existed: found.exists, site: site.name };
    },
    [braze, entity, site.name, account, queryClient],
  );
}
