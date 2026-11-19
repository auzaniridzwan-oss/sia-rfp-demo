/**
 * Small ring-buffer logger. Never log PII (emails, names, phone numbers) — log IDs that
 * are already pseudonymous (CEID, PNR) or counts/flags instead.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

type Listener = (entry: LogEntry) => void;

export class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  constructor(private readonly capacity = 200) {}

  debug(scope: string, message: string, data?: unknown) {
    this.push('debug', scope, message, data);
  }
  info(scope: string, message: string, data?: unknown) {
    this.push('info', scope, message, data);
  }
  warn(scope: string, message: string, data?: unknown) {
    this.push('warn', scope, message, data);
  }
  error(scope: string, message: string, data?: unknown) {
    this.push('error', scope, message, data);
  }

  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private push(level: LogLevel, scope: string, message: string, data?: unknown) {
    const entry: LogEntry = { id: ++this.seq, ts: Date.now(), level, scope, message, data };
    this.entries.push(entry);
    if (this.entries.length > this.capacity) this.entries.shift();
    const fn = level === 'debug' ? console.debug : console[level];
    fn(`[${scope}] ${message}`, ...(data === undefined ? [] : [data]));
    this.listeners.forEach((l) => l(entry));
  }
}
