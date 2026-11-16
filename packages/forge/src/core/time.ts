// packages/forge/src/core/time.ts
// ─────────────────────────────────────────────────────────────────────
// Global Time & Date Helpers (Laravel now() / Carbon equivalent).
// Respects app.timezone configured in config/app.ts.
// ─────────────────────────────────────────────────────────────────────

import { getConfigManager } from '../config/ConfigManager.js';

export function getTimezone(): string {
  try {
    const cfg = getConfigManager();
    const tz = cfg?.get<string>('app.timezone', 'UTC') ?? 'UTC';
    return tz;
  } catch {
    const envTz = process.env.APP_TIMEZONE ?? process.env.TZ ?? 'UTC';
    return envTz;
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
      hourCycle: 'h23',
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
  const tz = d.getTimezone();
  const [year, month, day] = d.toDateString().split('-').map(Number);
  return new ForgeDate(zonedMidnightToUtc(year, month, day, tz), tz);
}

/**
 * Resolve the UTC instant at which the given calendar date starts (00:00:00)
 * in an IANA timezone, independent of the process's own local timezone.
 */
function zonedMidnightToUtc(year: number, month: number, day: number, timezone: string): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);

  const offsetAt = (instant: number): number => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') map[p.type] = Number(p.value);
    }
    const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second);
    return asUtc - instant;
  };

  // Two passes settle the offset across DST transitions
  let instant = wallClockAsUtc - offsetAt(wallClockAsUtc);
  instant = wallClockAsUtc - offsetAt(instant);
  return new Date(instant);
}
