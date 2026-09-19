// packages/forge/src/database/serializer.ts
// ─────────────────────────────────────────────────────────────────────
// Database Value Serializer.
// Converts application values (Date, ForgeDate, ISO-8601 strings) into
// database-compatible representations based on driver and timezone policy.
// ─────────────────────────────────────────────────────────────────────

import { getTimezone, ForgeDate } from '../core/time.js';

/**
 * ISO-8601 DateTime regex matching YYYY-MM-DDTHH:mm:ss(.sss)?(Z|+/-HH:mm)?
 */
const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * MySQL DATETIME format regex YYYY-MM-DD HH:mm:ss(.sss)?
 */
const MYSQL_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/;

/**
 * Format a valid JavaScript Date into a MySQL-compatible DATETIME string
 * (YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm:ss.sss) in the specified timezone.
 *
 * Defaults to the configured application timezone (app.timezone, defaulting to UTC).
 */
export function formatMysqlDateTime(date: Date, timezone: string = getTimezone()): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new TypeError('[ForgeTS Database Serialization Error] Invalid Date value cannot be serialized for MySQL datetime.');
  }

  if (timezone === 'UTC' || timezone === 'Z') {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const h = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    const s = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = date.getUTCMilliseconds();
    const base = `${y}-${m}-${d} ${h}:${min}:${s}`;
    return ms > 0 ? `${base}.${String(ms).padStart(3, '0')}` : base;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const base = `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
  const ms = date.getMilliseconds();
  return ms > 0 ? `${base}.${String(ms).padStart(3, '0')}` : base;
}

/**
 * Serialize a single value for database binding.
 *
 * Rules:
 * - null -> null
 * - undefined -> undefined
 * - Date:
 *     - If invalid: throws TypeError
 *     - If driver is 'mysql' (or SQL): formats to MySQL DATETIME string
 *     - If driver is 'mongodb': preserves native Date
 * - ForgeDate:
 *     - If driver is 'mysql' (or SQL): formats to MySQL DATETIME string
 *     - If driver is 'mongodb': returns underlying Date
 * - String:
 *     - If ISO-8601 string and driver is 'mysql': parses and normalizes to MySQL DATETIME
 *     - If already MySQL DATETIME: preserved as-is
 *     - Arbitrary strings: preserved as-is
 * - Other primitives (numbers, booleans): preserved as-is
 */
export function serializeDatabaseValue(
  value: unknown,
  driver: string = 'mysql',
  timezone: string = getTimezone()
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle native Date instances
  if (value instanceof Date) {
    if (isNaN(value.getTime())) {
      throw new TypeError('[ForgeTS Database Serialization Error] Invalid Date value cannot be serialized for database persistence.');
    }
    if (driver === 'mongodb') {
      return value;
    }
    return formatMysqlDateTime(value, timezone);
  }

  // Handle ForgeDate instances
  if (value instanceof ForgeDate) {
    const rawDate = value.toDate();
    if (isNaN(rawDate.getTime())) {
      throw new TypeError('[ForgeTS Database Serialization Error] Invalid ForgeDate value cannot be serialized for database persistence.');
    }
    if (driver === 'mongodb') {
      return rawDate;
    }
    return formatMysqlDateTime(rawDate, timezone);
  }

  // Handle string values
  if (typeof value === 'string') {
    if (driver === 'mysql') {
      // Check if string is an ISO-8601 timestamp with T separator
      if (ISO_8601_REGEX.test(value)) {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) {
          throw new TypeError(`[ForgeTS Database Serialization Error] Malformed ISO-8601 datetime string "${value}" cannot be serialized for database persistence.`);
        }
        return formatMysqlDateTime(parsed, timezone);
      }
    }
    // Return other strings untouched (including existing MySQL datetime strings)
    return value;
  }

  return value;
}

/**
 * Serialize an entire dictionary of model attributes before passing to SQL query builder.
 */
export function serializeModelAttributes(
  attributes: Record<string, any>,
  driver: string = 'mysql',
  timezone: string = getTimezone()
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(attributes)) {
    if (val !== undefined) {
      result[key] = serializeDatabaseValue(val, driver, timezone);
    }
  }
  return result;
}
