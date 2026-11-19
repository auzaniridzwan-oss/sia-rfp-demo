/**
 * Minimal Braze REST client (server-only). Env: BRAZE_REST_API_KEY, BRAZE_REST_URL.
 */
export class BrazeRestError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Braze REST ${status}: ${body.slice(0, 300)}`);
  }
}

export interface BrazeRestConfig {
  apiKey: string;
  baseUrl: string;
}

export function brazeRestConfig(env: Record<string, string | undefined> = process.env): BrazeRestConfig | null {
  const apiKey = env.BRAZE_REST_API_KEY;
  const baseUrl = env.BRAZE_REST_URL ?? env.BRAZE_REST_API_URL;
  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, '') };
}

export async function brazeRequest<T = unknown>(cfg: BrazeRestConfig, path: string, body?: unknown, method = 'POST'): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new BrazeRestError(res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

/** Fields the debug overlay shows. Phone/last name are not exported; email is masked by the handler. */
export const PROFILE_FIELDS = [
  'external_id',
  'braze_id',
  'user_aliases',
  'first_name',
  'email',
  'email_subscribe',
  'push_subscribe',
  'created_at',
  'custom_attributes',
  'custom_events',
  'purchases',
  'total_revenue',
  'apps',
] as const;

export interface ExportedUser {
  external_id?: string;
  email?: string;
  [k: string]: unknown;
}

export async function exportUser(cfg: BrazeRestConfig, externalId: string): Promise<ExportedUser | null> {
  const data = await brazeRequest<{ users?: ExportedUser[] }>(cfg, '/users/export/ids', {
    external_ids: [externalId],
    fields_to_export: PROFILE_FIELDS,
  });
  return data.users?.[0] ?? null;
}

/** /users/track — attributes, events and purchases for server-side writes. */
export function trackUsers(
  cfg: BrazeRestConfig,
  payload: { attributes?: object[]; events?: object[]; purchases?: object[] },
) {
  return brazeRequest<{ message: string; errors?: unknown[] }>(cfg, '/users/track', payload);
}

/** z***@example.com */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}
