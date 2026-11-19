import type * as BrazeSdk from '@braze/web-sdk';
import type { WebEntity } from '../entity';
import type { Logger } from '../logger';
import type { Storage } from '../storage';
import { ALIAS_LABELS, SDK_ATTRIBUTES, type SdkAttributeKey } from './attributes';
import { validateEvent, type EventProps, type SdkEventName } from './events';

type Sdk = typeof BrazeSdk;

export interface BrazeClientConfig {
  entity: WebEntity;
  apiKey: string;
  baseUrl: string;
  storage: Storage;
  logger: Logger;
  /** Verbose Braze SDK console logging. */
  sdkLogging?: boolean;
}

/** One line in the debug overlay's live activity stream. */
export interface SdkActivity {
  id: number;
  ts: number;
  kind: 'init' | 'identity' | 'event' | 'attribute' | 'purchase' | 'subscription' | 'flush' | 'reset' | 'rest' | 'message';
  name: string;
  payload?: unknown;
  status: 'sent' | 'rejected' | 'failed';
  detail?: string;
}

export interface UserProfileInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  /** E.164, e.g. +6591234567 */
  phone?: string;
}

type Listener = (a: SdkActivity) => void;

const STORAGE_EXTERNAL_ID = 'braze_external_id';
const STORAGE_ANON_ALIAS = 'anon_alias';
const STORAGE_ANON_ACTIVITY = 'anon_activity';
/** Alias label put on anonymous visitors so their activity can be merged after login. */
export const ANONYMOUS_ALIAS_LABEL = 'sia_web_anonymous';

/**
 * Thin, typed wrapper around @braze/web-sdk shared by both sites.
 * - Lazily imports the SDK (browser only).
 * - Validates every custom event against EVENT_CATALOG and adds `entity`.
 * - Emits an activity stream for the Braze debug overlay.
 */
export class BrazeClient {
  readonly entity: WebEntity;
  private sdk: Sdk | null = null;
  private initPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();
  private activity: SdkActivity[] = [];
  private seq = 0;

  constructor(private readonly config: BrazeClientConfig) {
    this.entity = config.entity;
  }

  /** Initialise once; safe to call repeatedly (React StrictMode double-mounts). */
  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit() {
    const { apiKey, baseUrl, sdkLogging, storage, logger } = this.config;
    try {
      const sdk = await import('@braze/web-sdk');
      const ok = sdk.initialize(apiKey, {
        baseUrl,
        enableLogging: sdkLogging ?? false,
        // Required for Braze Banners (insertBanner) and HTML in-app messages.
        allowUserSuppliedJavascript: true,
        minimumIntervalBetweenTriggerActionsInSeconds: 5,
        sessionTimeoutInSeconds: 1800,
      });
      if (!ok) throw new Error('braze.initialize returned false');
      this.sdk = sdk;
      sdk.automaticallyShowInAppMessages();
      // Observe (not replace) in-app message display for the debug overlay's Messaging tab.
      sdk.subscribeToInAppMessage((m) => {
        const msg = m as unknown as { message?: string; header?: string; extras?: Record<string, string>; constructor: { name: string } };
        this.emit({ kind: 'message', name: `in-app message (${msg.constructor?.name ?? 'IAM'})`, status: 'sent', payload: { header: msg.header, message: msg.message?.slice(0, 200), extras: msg.extras } });
      });

      const restored = storage.get<string>(STORAGE_EXTERNAL_ID);
      if (restored) sdk.changeUser(restored);
      sdk.openSession();
      if (!restored) this.ensureAnonymousAlias(sdk);

      this.emit({ kind: 'init', name: 'initialize', status: 'sent', payload: { entity: this.entity, baseUrl, restoredUser: restored ?? null } });
      logger.info('braze', `SDK ready (${this.entity})`, { restoredUser: restored ?? null });
    } catch (e) {
      this.emit({ kind: 'init', name: 'initialize', status: 'failed', detail: String(e) });
      logger.error('braze', 'SDK init failed', String(e));
    }
  }

  /**
   * Give an anonymous visitor a user alias (`{entity}-{deviceId}`), so that if they later
   * log in to an EXISTING profile — where Braze would orphan the anonymous data — the
   * server can merge it with /users/merge (docs/BUILD_PLAN.md §3).
   */
  private ensureAnonymousAlias(sdk: Sdk) {
    const { storage } = this.config;
    if (storage.get<string>(STORAGE_ANON_ALIAS)) return;
    const deviceId = sdk.getDeviceId();
    if (!deviceId) return;
    const alias = `${this.entity}-${deviceId}`;
    sdk.getUser()?.addAlias(alias, ANONYMOUS_ALIAS_LABEL);
    storage.set(STORAGE_ANON_ALIAS, alias);
    this.emit({ kind: 'identity', name: 'addAlias (anonymous)', status: 'sent', payload: { alias_name: alias, alias_label: ANONYMOUS_ALIAS_LABEL } });
  }

  /**
   * The anonymous alias to merge after login, if the visitor did anything while anonymous.
   * Clears the flags so a merge is only requested once.
   */
  takeAnonymousAlias(): string | null {
    const { storage } = this.config;
    const alias = storage.get<string>(STORAGE_ANON_ALIAS);
    const active = storage.get<boolean>(STORAGE_ANON_ACTIVITY);
    storage.remove(STORAGE_ANON_ALIAS);
    storage.remove(STORAGE_ANON_ACTIVITY);
    return alias && active ? alias : null;
  }

  /** The SDK module once initialised (for content cards / banners hooks). */
  get raw(): Sdk | null {
    return this.sdk;
  }

  get externalId(): string | null {
    return this.config.storage.get<string>(STORAGE_EXTERNAL_ID);
  }

  get deviceId(): string | null {
    return this.sdk?.getDeviceId() ?? null;
  }

  /**
   * Identify the user as their CEID and set standard fields. Also records that this
   * profile holds an account with this entity (sia_registered_entities) and attaches the
   * entity alias so one profile carries every entity's identifier.
   */
  identify(ceid: string, profile: UserProfileInput = {}) {
    const sdk = this.requireSdk('changeUser');
    if (!sdk) return;
    sdk.changeUser(ceid);
    this.config.storage.set(STORAGE_EXTERNAL_ID, ceid);
    const user = sdk.getUser();
    if (profile.email) user?.setEmail(profile.email);
    if (profile.firstName) user?.setFirstName(profile.firstName);
    if (profile.lastName) user?.setLastName(profile.lastName);
    if (profile.phone) user?.setPhoneNumber(profile.phone);
    user?.addToCustomAttributeArray(SDK_ATTRIBUTES.registeredEntities, this.entity);
    user?.addAlias(`${this.entity}-${ceid.slice(-8)}`, ALIAS_LABELS[this.entity]);
    this.emit({
      kind: 'identity',
      name: 'changeUser',
      status: 'sent',
      payload: {
        external_id: ceid,
        fields: Object.keys(profile).filter((k) => profile[k as keyof UserProfileInput]),
        alias_label: ALIAS_LABELS[this.entity],
      },
    });
  }

  /** Log a catalogued custom event. Invalid payloads are rejected (and shown in the overlay). */
  track<E extends SdkEventName>(name: E, props: EventProps<E>): boolean {
    const result = validateEvent(name, props as Record<string, unknown>, this.entity);
    if (!result.ok) {
      this.emit({ kind: 'event', name, status: 'rejected', payload: props, detail: result.issues.join('; ') });
      this.config.logger.warn('braze', `Rejected event ${name}`, result.issues);
      return false;
    }
    const sdk = this.requireSdk(name);
    if (!sdk) return false;
    const ok = sdk.logCustomEvent(name, result.props);
    if (!this.externalId) this.config.storage.set(STORAGE_ANON_ACTIVITY, true);
    this.emit({ kind: 'event', name, status: ok ? 'sent' : 'failed', payload: result.props });
    return ok;
  }

  setAttribute(key: SdkAttributeKey, value: string | number | boolean | Date | string[] | null) {
    const user = this.requireSdk(key)?.getUser();
    if (!user) return false;
    const ok = user.setCustomUserAttribute(key, value);
    this.emit({ kind: 'attribute', name: key, status: ok ? 'sent' : 'failed', payload: value });
    return ok;
  }

  addToArray(key: SdkAttributeKey, value: string) {
    const user = this.requireSdk(key)?.getUser();
    if (!user) return false;
    const ok = user.addToCustomAttributeArray(key, value);
    this.emit({ kind: 'attribute', name: `${key} += ${value}`, status: ok ? 'sent' : 'failed', payload: value });
    return ok;
  }

  logPurchase(productId: string, priceSgd: number, properties: Record<string, unknown> = {}) {
    const sdk = this.requireSdk(productId);
    if (!sdk) return false;
    const props = { entity: this.entity, ...properties };
    const ok = sdk.logPurchase(productId, priceSgd, 'SGD', 1, props);
    this.emit({ kind: 'purchase', name: productId, status: ok ? 'sent' : 'failed', payload: { price: priceSgd, currency: 'SGD', ...props } });
    return ok;
  }

  setSubscriptionGroup(groupId: string, subscribed: boolean) {
    const user = this.requireSdk(groupId)?.getUser();
    if (!user) return false;
    const ok = subscribed ? user.addToSubscriptionGroup(groupId) : user.removeFromSubscriptionGroup(groupId);
    this.emit({ kind: 'subscription', name: groupId, status: ok ? 'sent' : 'failed', payload: { subscribed } });
    return ok;
  }

  /** Send queued data now (the debug overlay calls this before re-reading the REST profile). */
  flush(): Promise<boolean> {
    const sdk = this.requireSdk('flush');
    if (!sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      sdk.requestImmediateDataFlush((ok) => {
        this.emit({ kind: 'flush', name: 'requestImmediateDataFlush', status: ok ? 'sent' : 'failed' });
        resolve(ok);
      });
    });
  }

  /** Forget the user on this browser (demo reset). Does not delete the Braze profile. */
  reset() {
    this.sdk?.wipeData();
    this.config.storage.remove(STORAGE_EXTERNAL_ID);
    this.config.storage.remove(STORAGE_ANON_ALIAS);
    this.config.storage.remove(STORAGE_ANON_ACTIVITY);
    this.emit({ kind: 'reset', name: 'wipeData', status: 'sent' });
    // wipeData requires a fresh initialize on next use.
    this.sdk = null;
    this.initPromise = null;
  }

  /** Forget the user and start a fresh anonymous session (demo "sign out"). */
  async signOut() {
    this.reset();
    await this.init();
  }

  /**
   * Record a server-side (REST) write in the activity stream, so the debug overlay shows
   * nested attributes and catalog writes alongside SDK calls.
   */
  noteRest(name: string, status: SdkActivity['status'], payload?: unknown, detail?: string) {
    this.emit({ kind: 'rest', name, status, payload, detail });
  }

  getActivity(): readonly SdkActivity[] {
    return this.activity;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private requireSdk(what: string): Sdk | null {
    if (this.sdk) return this.sdk;
    this.emit({ kind: 'event', name: what, status: 'failed', detail: 'SDK not initialised' });
    return null;
  }

  private emit(a: Omit<SdkActivity, 'id' | 'ts'>) {
    const entry: SdkActivity = { id: ++this.seq, ts: Date.now(), ...a };
    this.activity.push(entry);
    if (this.activity.length > 200) this.activity.shift();
    this.listeners.forEach((l) => l(entry));
  }
}
