/**
 * Namespaced browser storage. Every key is prefixed with `sia_{entity}_` so the SQ and
 * Scoot sites never collide, even on localhost. Reads/writes never throw (private mode,
 * blocked storage, SSR): they fall back to an in-memory map.
 */
export interface Storage {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  /** Remove every key under this namespace. */
  clear(): void;
  readonly prefix: string;
}

export function createStorage(namespace: string, backend: 'local' | 'session' = 'local'): Storage {
  const prefix = `sia_${namespace.toLowerCase()}_`;
  const memory = new Map<string, string>();

  const store = (): globalThis.Storage | null => {
    try {
      const s = backend === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
      return s ?? null;
    } catch {
      return null;
    }
  };

  const raw = {
    get(k: string): string | null {
      try {
        return store()?.getItem(k) ?? memory.get(k) ?? null;
      } catch {
        return memory.get(k) ?? null;
      }
    },
    set(k: string, v: string) {
      memory.set(k, v);
      try {
        store()?.setItem(k, v);
      } catch {
        /* quota or blocked: memory copy still works for this page */
      }
    },
    remove(k: string) {
      memory.delete(k);
      try {
        store()?.removeItem(k);
      } catch {
        /* ignore */
      }
    },
  };

  return {
    prefix,
    get<T>(key: string): T | null {
      const v = raw.get(prefix + key);
      if (v == null) return null;
      try {
        return JSON.parse(v) as T;
      } catch {
        return null;
      }
    },
    set<T>(key: string, value: T) {
      raw.set(prefix + key, JSON.stringify(value));
    },
    remove(key: string) {
      raw.remove(prefix + key);
    },
    clear() {
      for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
      try {
        const s = store();
        if (!s) return;
        const keys: string[] = [];
        for (let i = 0; i < s.length; i++) {
          const k = s.key(i);
          if (k?.startsWith(prefix)) keys.push(k);
        }
        keys.forEach((k) => s.removeItem(k));
      } catch {
        /* ignore */
      }
    },
  };
}
