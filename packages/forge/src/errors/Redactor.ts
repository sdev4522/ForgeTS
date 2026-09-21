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

  private static readonly SENSITIVE_KEY_PATTERN =
    /^(password|password_confirmation|secret|token|access_token|refresh_token|api_key|authorization|credit_card|card_number|cvv|key|auth|credential|private_key|client_secret|signing_key)$/i;

  private static readonly SENSITIVE_HEADER_PATTERN =
    /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|api-key|token|access-token|refresh-token|x-csrf-token|x-xsrf-token|csrf-token|secret|password|auth)$/i;

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
      /([?&](?:token|key|password|secret|auth|access_token|api_key)=)([^&#\s]+)/gi,
      '$1[REDACTED]',
    );

    // 3. Redact Bearer tokens in string (ignore English word 'token' as in 'Missing bearer token')
    result = result.replace(/(Bearer\s+)(?!token\b)[a-zA-Z0-9._~+/-]+=*/gi, '$1[REDACTED]');

    // 4. Scan process.env secret values
    for (const [key, val] of Object.entries(process.env)) {
      if (!val || typeof val !== 'string') continue;
      const trimmedVal = val.trim();
      if (trimmedVal.length < 4 || this.SAFE_WHITELIST.has(trimmedVal)) continue;

      const isSystemVar =
        /^(HOME|PWD|PATH|SHELL|USER|LOGNAME|TERM|SHLVL|_|OLDPWD|EDITOR|VISUAL|BROWSER|LANG|COLORTERM|TZ)$/i.test(key) ||
        key.startsWith('XDG_') ||
        key.startsWith('BUN_') ||
        key.startsWith('NODE_') ||
        key.startsWith('npm_');

      if (isSystemVar) continue;

      const isSecretKey =
        /SECRET|PASS|KEY|TOKEN|DB|AUTH|CREDENTIAL|PRIVATE|CERT|DATABASE|MONGO|MYSQL|REDIS|DSN|SIGNING|API/i.test(key);

      if (isSecretKey && trimmedVal.length >= 4) {
        if (result.includes(trimmedVal)) {
          result = result.replaceAll(trimmedVal, '[REDACTED]');
        }
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
