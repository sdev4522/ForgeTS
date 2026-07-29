// packages/forge/src/security/hash.ts
// ─────────────────────────────────────────────────────────────────────
// Password Hashing Utility (Laravel Hash facade equivalent).
// Uses native Argon2id via Bun runtime (Bun.password) with crypto fallback.
// ─────────────────────────────────────────────────────────────────────

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export class Hash {
  /**
   * Hash a plain-text password using Argon2id.
   * Uses Bun's native SIMD-accelerated C++ Argon2id implementation.
   *
   * @example
   * ```ts
   * const hashedPassword = await hash.make('secret123');
   * ```
   */
  static async make(plainPassword: string): Promise<string> {
    if (typeof Bun !== 'undefined' && Bun.password) {
      return Bun.password.hash(plainPassword, {
        algorithm: 'argon2id',
        timeCost: 3,
        memoryCost: 65536,
      });
    }

    // Node.js fallback using crypto.scrypt
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
    return `scrypt:${salt}:${buf.toString('hex')}`;
  }

  /**
   * Verify a plain-text password against a hashed password string.
   *
   * @example
   * ```ts
   * const isValid = await hash.verify('secret123', hashedPassword);
   * ```
   */
  static async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (!plainPassword || !hashedPassword) return false;

    if (typeof Bun !== 'undefined' && Bun.password) {
      try {
        return await Bun.password.verify(plainPassword, hashedPassword);
      } catch {
        return false;
      }
    }

    // Node.js scrypt fallback verification
    if (hashedPassword.startsWith('scrypt:')) {
      const parts = hashedPassword.split(':');
      if (parts.length !== 3) return false;
      const [, salt, hashHex] = parts;
      const buf = (await scryptAsync(plainPassword, salt, 64)) as Buffer;
      const keyBuffer = Buffer.from(hashHex, 'hex');
      return timingSafeEqual(buf, keyBuffer);
    }

    return false;
  }
}

/** Global hash helper singleton */
export const hash = Hash;
