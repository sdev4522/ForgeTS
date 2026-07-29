// packages/forge/src/http/Validator.ts
// ─────────────────────────────────────────────────────────────────────
// Laravel-style Pipe-Separated String Input Validator.
// Provides declarative rule validation for HTTP requests.
// ─────────────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  public readonly statusCode = 422;
  public readonly errors: Record<string, string[]>;

  constructor(errors: Record<string, string[]>) {
    super('The given data was invalid.');
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export type ValidationRules = Record<string, string>;

export class Validator {
  /**
   * Validate an input object against pipe-separated rules (Laravel-style).
   * Returns an object containing ONLY the validated fields.
   * Throws `ValidationError` on failure.
   */
  static validate<T = Record<string, any>>(data: unknown, rules: ValidationRules): T {
    const input = data && typeof data === 'object' ? (data as Record<string, any>) : {};
    const errors: Record<string, string[]> = {};
    const validatedData: Record<string, any> = {};

    for (const [field, ruleString] of Object.entries(rules)) {
      const value = input[field];
      const pipeRules = ruleString
        .split('|')
        .map((r) => r.trim())
        .filter(Boolean);

      const isRequired = pipeRules.includes('required');

      // Check required rule first
      if (value === undefined || value === null || value === '') {
        if (isRequired) {
          this.addError(errors, field, `The ${field} field is required.`);
        }
        continue; // Skip remaining type/min/max checks if field is missing & optional
      }

      // Process rules for non-empty value
      for (const rule of pipeRules) {
        if (rule === 'required') continue;

        if (rule === 'string') {
          if (typeof value !== 'string') {
            this.addError(errors, field, `The ${field} must be a string.`);
          }
        } else if (rule === 'numeric') {
          const num = Number(value);
          if (isNaN(num) || (typeof value === 'string' && value.trim() === '')) {
            this.addError(errors, field, `The ${field} must be a number.`);
          }
        } else if (rule === 'boolean') {
          if (
            typeof value !== 'boolean' &&
            value !== 'true' &&
            value !== 'false' &&
            value !== 1 &&
            value !== 0
          ) {
            this.addError(errors, field, `The ${field} must be a boolean.`);
          }
        } else if (rule === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof value !== 'string' || !emailRegex.test(value)) {
            this.addError(errors, field, `The ${field} must be a valid email address.`);
          }
        } else if (rule.startsWith('min:')) {
          const minVal = parseFloat(rule.slice(4));
          if (typeof value === 'number') {
            if (value < minVal) {
              this.addError(errors, field, `The ${field} must be at least ${minVal}.`);
            }
          } else if (typeof value === 'string' || Array.isArray(value)) {
            if (value.length < minVal) {
              this.addError(errors, field, `The ${field} must be at least ${minVal} characters.`);
            }
          }
        } else if (rule.startsWith('max:')) {
          const maxVal = parseFloat(rule.slice(4));
          if (typeof value === 'number') {
            if (value > maxVal) {
              this.addError(errors, field, `The ${field} may not be greater than ${maxVal}.`);
            }
          } else if (typeof value === 'string' || Array.isArray(value)) {
            if (value.length < maxVal) {
              this.addError(errors, field, `The ${field} may not be greater than ${maxVal} characters.`);
            }
          }
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

  private static addError(errors: Record<string, string[]>, field: string, message: string): void {
    if (!errors[field]) {
      errors[field] = [];
    }
    errors[field].push(message);
  }
}
