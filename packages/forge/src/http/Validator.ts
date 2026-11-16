// packages/forge/src/http/Validator.ts
// ─────────────────────────────────────────────────────────────────────
// Laravel-style Pipe-Separated String Input Validator.
// Provides declarative rule validation for HTTP requests.
//
//   Validator.validate(input, {
//     email: 'required|email',
//     password: 'required|min:8|confirmed',
//     role: 'in:admin,editor',
//   });
// ─────────────────────────────────────────────────────────────────────

import { ValidationError } from '../errors/ForgeError.js';

// Single framework-wide validation error class (HTTP 422).
export { ValidationError };

/** Rules per field: a pipe-separated string or an array of rule strings. */
export type ValidationRules = Record<string, string | string[]>;

/** Custom messages keyed by `field.rule` (most specific) or `field`. */
export type ValidationMessages = Record<string, string>;

interface RuleContext {
  field: string;
  value: any;
  param: string;
  input: Record<string, any>;
  /** Field also carries the `numeric` or `integer` rule. */
  numeric: boolean;
}

/** Returns an error message, or null when the value passes. */
type RuleCheck = (ctx: RuleContext) => string | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sizeOf(value: unknown, numeric: boolean): { value: number; numeric: boolean } | null {
  if (typeof value === 'number') return { value, numeric: true };
  if (numeric && typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (!Number.isNaN(num)) return { value: num, numeric: true };
  }
  if (typeof value === 'string' || Array.isArray(value)) {
    return { value: value.length, numeric: false };
  }
  return null;
}

const RULES: Record<string, RuleCheck> = {
  string: ({ field, value }) =>
    typeof value === 'string' ? null : `The ${field} must be a string.`,

  numeric: ({ field, value }) => {
    const ok =
      typeof value === 'number'
        ? !Number.isNaN(value)
        : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
    return ok ? null : `The ${field} must be a number.`;
  },

  integer: ({ field, value }) => {
    const ok =
      typeof value === 'number'
        ? Number.isInteger(value)
        : typeof value === 'string' && /^-?\d+$/.test(value.trim());
    return ok ? null : `The ${field} must be an integer.`;
  },

  boolean: ({ field, value }) =>
    typeof value === 'boolean' || ['true', 'false', '1', '0', 1, 0].includes(value)
      ? null
      : `The ${field} must be a boolean.`,

  array: ({ field, value }) => (Array.isArray(value) ? null : `The ${field} must be an array.`),

  email: ({ field, value }) =>
    typeof value === 'string' && EMAIL.test(value)
      ? null
      : `The ${field} must be a valid email address.`,

  url: ({ field, value }) => {
    try {
      const parsed = new URL(String(value));
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return null;
    } catch {}
    return `The ${field} must be a valid URL.`;
  },

  uuid: ({ field, value }) =>
    typeof value === 'string' && UUID.test(value) ? null : `The ${field} must be a valid UUID.`,

  date: ({ field, value }) => {
    const ok =
      value instanceof Date
        ? !Number.isNaN(value.getTime())
        : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Date.parse(value));
    return ok ? null : `The ${field} must be a valid date.`;
  },

  alpha: ({ field, value }) =>
    typeof value === 'string' && /^\p{L}+$/u.test(value)
      ? null
      : `The ${field} may only contain letters.`,

  alpha_num: ({ field, value }) =>
    typeof value === 'string' && /^[\p{L}\p{N}]+$/u.test(value)
      ? null
      : `The ${field} may only contain letters and numbers.`,

  min: ({ field, value, param, numeric }) => {
    const limit = parseFloat(param);
    const size = sizeOf(value, numeric);
    if (size === null || size.value >= limit) return null;
    return size.numeric
      ? `The ${field} must be at least ${limit}.`
      : `The ${field} must be at least ${limit} characters.`;
  },

  max: ({ field, value, param, numeric }) => {
    const limit = parseFloat(param);
    const size = sizeOf(value, numeric);
    if (size === null || size.value <= limit) return null;
    return size.numeric
      ? `The ${field} may not be greater than ${limit}.`
      : `The ${field} may not be greater than ${limit} characters.`;
  },

  between: ({ field, value, param, numeric }) => {
    const [low, high] = param.split(',').map(parseFloat);
    const size = sizeOf(value, numeric);
    if (size === null || (size.value >= low && size.value <= high)) return null;
    return size.numeric
      ? `The ${field} must be between ${low} and ${high}.`
      : `The ${field} must be between ${low} and ${high} characters.`;
  },

  size: ({ field, value, param, numeric }) => {
    const exact = parseFloat(param);
    const size = sizeOf(value, numeric);
    if (size === null || size.value === exact) return null;
    return size.numeric
      ? `The ${field} must be ${exact}.`
      : `The ${field} must be ${exact} characters.`;
  },

  in: ({ field, value, param }) =>
    param.split(',').includes(String(value)) ? null : `The selected ${field} is invalid.`,

  not_in: ({ field, value, param }) =>
    param.split(',').includes(String(value)) ? `The selected ${field} is invalid.` : null,

  confirmed: ({ field, value, input }) =>
    Object.hasOwn(input, `${field}_confirmation`) && input[`${field}_confirmation`] === value
      ? null
      : `The ${field} confirmation does not match.`,

  same: ({ field, value, param, input }) =>
    Object.hasOwn(input, param) && input[param] === value
      ? null
      : `The ${field} and ${param} must match.`,

  different: ({ field, value, param, input }) =>
    Object.hasOwn(input, param) && input[param] === value
      ? `The ${field} and ${param} must be different.`
      : null,

  regex: ({ field, value, param }) => {
    // Accepts `regex:^[a-z]+$` or `regex:/^[a-z]+$/i`
    const literal = /^\/(.*)\/([a-z]*)$/.exec(param);
    const pattern = literal ? new RegExp(literal[1], literal[2]) : new RegExp(param);
    return typeof value === 'string' && pattern.test(value)
      ? null
      : `The ${field} format is invalid.`;
  },
};

// Rules that only shape how other rules behave
const MODIFIERS = new Set(['required', 'nullable', 'sometimes', 'bail']);

export class Validator {
  /**
   * Register a custom rule usable in rule strings.
   *
   * @example
   * ```ts
   * Validator.extend('slug', ({ field, value }) =>
   *   /^[a-z0-9-]+$/.test(String(value)) ? null : `The ${field} must be a slug.`);
   * ```
   */
  static extend(name: string, check: RuleCheck): void {
    if (MODIFIERS.has(name)) {
      throw new Error(`[ForgeTS] '${name}' is a reserved validation rule name.`);
    }
    RULES[name] = check;
  }

  /** Names of every available rule. */
  static rules(): string[] {
    return [...MODIFIERS, ...Object.keys(RULES)].sort();
  }

  /**
   * Validate an input object against pipe-separated rules (Laravel-style).
   * Returns an object containing ONLY the validated fields.
   * Throws `ValidationError` on failure.
   */
  static validate<T = Record<string, any>>(
    data: unknown,
    rules: ValidationRules,
    messages: ValidationMessages = {},
  ): T {
    const input = data && typeof data === 'object' ? (data as Record<string, any>) : {};
    const own = (key: string) => (Object.hasOwn(input, key) ? input[key] : undefined);
    const errors: Record<string, string[]> = {};
    const validatedData: Record<string, any> = {};

    for (const [field, ruleSpec] of Object.entries(rules)) {
      const value = own(field);
      // A regex rule may itself contain `|`, so it always runs to the end of the string
      const pipeRules = (Array.isArray(ruleSpec) ? ruleSpec : this.splitRules(ruleSpec))
        .map((r) => r.trim())
        .filter(Boolean);

      const names = pipeRules.map((r) => r.split(':')[0]);
      const isRequired = names.includes('required');
      const bail = names.includes('bail');
      const numeric = names.includes('numeric') || names.includes('integer');

      const fail = (rule: string, fallback: string) => {
        (errors[field] ??= []).push(messages[`${field}.${rule}`] ?? messages[field] ?? fallback);
      };

      // Check required rule first
      if (value === undefined || value === null || value === '') {
        if (isRequired) {
          fail('required', `The ${field} field is required.`);
        }
        continue; // Skip remaining checks if field is missing & optional
      }

      for (const rule of pipeRules) {
        const separator = rule.indexOf(':');
        const name = separator === -1 ? rule : rule.slice(0, separator);
        const param = separator === -1 ? '' : rule.slice(separator + 1);
        if (MODIFIERS.has(name)) continue;

        const check = RULES[name];
        if (!check) {
          throw new Error(
            `[ForgeTS] Unknown validation rule '${name}' on field '${field}'. ` +
              `Available rules: ${this.rules().join(', ')}.`,
          );
        }

        const message = check({ field, value, param, input, numeric });
        if (message !== null) {
          fail(name, message);
          if (bail) break;
        }
      }

      // If field has no validation errors, collect into validated output
      if (!errors[field]) {
        validatedData[field] = value;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError(errors);
    }

    return validatedData as T;
  }

  private static splitRules(spec: string): string[] {
    const regexAt = spec.search(/(^|\|)regex:/);
    if (regexAt === -1) return spec.split('|');
    const start = spec[regexAt] === '|' ? regexAt + 1 : regexAt;
    const before = spec.slice(0, start).split('|');
    return [...before, spec.slice(start)];
  }
}
