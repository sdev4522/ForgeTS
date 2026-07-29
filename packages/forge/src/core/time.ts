// packages/forge/src/core/time.ts
// ─────────────────────────────────────────────────────────────────────
// Global Time & Date Helpers (Laravel now() / Carbon equivalent).
// Respects app.timezone configured in config/app.ts.
// ─────────────────────────────────────────────────────────────────────

import { getConfigManager } from '../config/ConfigManager.js';

export function getTimezone(): string {
  try {
    const cfg = getConfigManager();
    const tz = cfg?.get<string>('app.timezone', 'Asia/Kolkata') ?? 'Asia/Kolkata';
    return tz === 'IST' ? 'Asia/Kolkata' : tz;
  } catch {
    const envTz = process.env.APP_TIMEZONE ?? process.env.TZ ?? 'Asia/Kolkata';
    return envTz === 'IST' ? 'Asia/Kolkata' : envTz;
  }
}

export class ForgeDate {
  private _date: Date;
  private _timezone: string;

  constructor(date?: Date | string | number, timezone?: string) {
    this._date = date ? new Date(date) : new Date();
    this._timezone = timezone ?? getTimezone();
  }

  /**
   * Format date to SQL-compatible datetime string (YYYY-MM-DD HH:mm:ss)
   * in the configured application timezone.
   */
  toDateTimeString(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this._timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(this._date);

    const map: Record<string, string> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = p.value;
    }

    return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  }

  /** Format date to YYYY-MM-DD date string */
  toDateString(): string {
    return this.toDateTimeString().slice(0, 10);
  }

  /** Format date to ISO 8601 string */
  toISOString(): string {
    return this._date.toISOString();
  }

  /** Get underlying native Date object */
  toDate(): Date {
    return this._date;
  }

  /** Get current configured timezone */
  getTimezone(): string {
    return this._timezone;
  }
}

/**
 * Get current timestamp helper (Laravel now() equivalent).
 * Returns a `ForgeDate` instance configured with the app's timezone.
 *
 * @example
 * ```ts
 * const currentTime = now().toDateTimeString(); // '2026-07-29 13:36:30'
 * ```
 */
export function now(timezone?: string): ForgeDate {
  return new ForgeDate(undefined, timezone);
}

/**
 * Get start of today helper (Laravel today() equivalent).
 *
 * @example
 * ```ts
 * const startOfToday = today().toDateTimeString(); // '2026-07-29 00:00:00'
 * ```
 */
export function today(timezone?: string): ForgeDate {
  const d = new ForgeDate(undefined, timezone);
  const dateStr = d.toDateString();
  return new ForgeDate(`${dateStr} 00:00:00`, timezone);
}
