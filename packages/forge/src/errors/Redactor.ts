// packages/forge/src/errors/Redactor.ts
// ─────────────────────────────────────────────────────────────────────
// Multi-layer secret and credential redaction engine.
// Guarantees zero mutation of original Error or request objects.
// Protects against environment leaks, URI credentials, tokens, and passwords.
// ─────────────────────────────────────────────────────────────────────

export class Redactor {
  private static readonly SAFE_WHITELIST = new Set([
    'true',
    'false',
    'development',
    'production',
    'test',
    '3000',
    '3306',
    '27017',
    'localhost',
    '127.0.0.1',
    'mysql',
    'mongodb',
    'ForgeTS',
    'en',
    'UTC',
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'HEAD',
    'OPTIONS',
    'null',
    'undefined',
  ]);

  // Matches whole keys (`key`, `auth`, `pin`) and any key CONTAINING a sensitive
  // word in snake_case, kebab-case or camelCase: user_password, newPassword,
  // accessToken, apiKey, client-secret, cardNumber …
  private static readonly SENSITIVE_KEY_PATTERN =
    /^(key|auth|pin|otp|cvv|cvc|ssn|_token)$|pass(word|wd|phrase)?|secret|token|api[_-]?key|authorization|credential|private[_-]?key|signing[_-]?key|credit[_-]?card|card[_-]?number|security[_-]?code/i;

  private static readonly SENSITIVE_HEADER_PATTERN =
    /^(cookie|set-cookie|auth|key)$|authorization|token|secret|password|api-?key|credential|signature|session/i;

  // Environment variable NAMES whose values are secrets. Deliberately excludes
  // broad words like DB / API / DATABASE: values such as DB_USERNAME=root or
  // DB_DATABASE=app are not secrets, and redacting them mangled unrelated text.
  // Connection strings are covered by URI_CREDENTIALS_REGEX instead.
  private static readonly SECRET_ENV_NAME_PATTERN =
    /SECRET|PASS|KEY|TOKEN|AUTH|CREDENTIAL|PRIVATE|CERT|DSN|SIGNING|SALT/i;

  private static envSecretsCache: { stamp: string; values: string[] } | null = null;

  /**
   * Secret values currently present in process.env, longest first.
   * Cached and rebuilt only when the environment's secret entries change.
   */
  private static envSecrets(): string[] {
    const values: string[] = [];
    let stamp = '';

    for (const key in process.env) {
      if (!this.SECRET_ENV_NAME_PATTERN.test(key)) continue;
      if (key.startsWith('npm_') || key.startsWith('NODE_') || key.startsWith('XDG_')) continue;
      const val = process.env[key];
      if (!val) continue;
      const trimmed = val.trim();
      if (trimmed.length < 4 || this.SAFE_WHITELIST.has(trimmed)) continue;
      values.push(trimmed);
      stamp += `${key}=${trimmed.length}:${trimmed}\u0000`;
    }

    if (this.envSecretsCache?.stamp === stamp) return this.envSecretsCache.values;
    values.sort((a, b) => b.length - a.length);
    this.envSecretsCache = { stamp, values };
    return values;
  }

  private static readonly URI_CREDENTIALS_REGEX =
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^:@\s]+):([^@\s]+)@/g;

  /**
   * Redact sensitive tokens, passwords, database connection credentials,
   * and process environment secrets from a string.
   */
  static redactString(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let result = text;

    // 1. Redact credentials embedded in database or HTTP URLs (e.g. mysql://user:pass@host)
    result = result.replace(this.URI_CREDENTIALS_REGEX, (_match, proto, user) => {
      return `${proto}${user}:[REDACTED]@`;
    });

    // 2. Redact sensitive query parameters in URLs (e.g. ?token=secret&key=123)
    result = result.replace(
      /([?&][\w.-]*(?:token|key|password|passwd|secret|auth|signature|credential)[\w.-]*=)([^&#\s]+)/gi,
      '$1[REDACTED]',
    );

    // 3. Redact Bearer tokens in string (ignore English word 'token' as in 'Missing bearer token')
    result = result.replace(/(Bearer\s+)(?!token\b)[a-zA-Z0-9._~+/-]+=*/gi, '$1[REDACTED]');

    // 4. Redact known secret values from process.env
    for (const secret of this.envSecrets()) {
      if (result.includes(secret)) {
        result = result.replaceAll(secret, '[REDACTED]');
      }
    }

    return result;
  }

  /**
   * Sanitize an object (like request headers) by redacting sensitive header keys.
   * Returns a new object without mutating the original.
   */
  static sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, val] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (this.SENSITIVE_HEADER_PATTERN.test(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.redactString(String(val));
      }
    }

    return sanitized;
  }

  /**
   * Recursively sanitize request body or arbitrary data, redacting passwords and credentials.
   * Protects against circular references and limits recursion depth.
   * Returns a new object/array without mutating the original.
   */
  static sanitizeData(data: unknown, depth = 0, seen = new WeakSet()): unknown {
    if (data === undefined || data === null) return data;
    if (depth > 6) return '[Truncated]';

    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }

    if (typeof data === 'object') {
      if (seen.has(data as object)) return '[Circular]';
      seen.add(data as object);

      if (Array.isArray(data)) {
        return data.map((item) => this.sanitizeData(item, depth + 1, seen));
      }

      // Check for buffer/stream/binary objects
      const ctorName = (data as any).constructor?.name;
      if (
        ctorName === 'Buffer' ||
        ctorName === 'Uint8Array' ||
        ctorName === 'ReadableStream' ||
        ctorName === 'ArrayBuffer'
      ) {
        return '[Binary Data]';
      }

      const sanitized: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(data)) {
        // Arrays under a sensitive key are kept: validation error bags are keyed by
        // field name (`password: ['The password field is required.']`).
        if (this.SENSITIVE_KEY_PATTERN.test(key) && !Array.isArray(val)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(val, depth + 1, seen);
        }
      }

      return sanitized;
    }

    return String(data);
  }
}
