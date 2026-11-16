// packages/forge/src/security/hash.ts
// ─────────────────────────────────────────────────────────────────────
// Password Hashing Utility (Laravel Hash facade equivalent).
// Uses Argon2id from node:crypto and emits standard PHC strings:
//   $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
// The format is interoperable with other Argon2 implementations, so
// hashes created under the previous Bun runtime keep verifying.
// ─────────────────────────────────────────────────────────────────────

import * as nodeCrypto from 'node:crypto';
import { promisify } from 'node:util';

const { scrypt, randomBytes, timingSafeEqual } = nodeCrypto;
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

interface Argon2Params {
  message: string | Buffer;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
}

type Argon2Fn = (
  algorithm: string,
  params: Argon2Params,
  callback: (err: Error | null, derivedKey: Buffer) => void,
) => void;

const ARGON2_VARIANTS = new Set(['argon2id', 'argon2i', 'argon2d']);

/** Sanity bounds applied to parameters read from a stored hash before deriving. */
const MAX_MEMORY_KIB = 1024 * 1024; // 1 GiB
const MAX_PASSES = 64;
const MAX_PARALLELISM = 64;

export interface HashOptions {
  /** Memory cost in KiB (default 65536 = 64 MiB). */
  memoryCost?: number;
  /** Number of passes (default 3). */
  timeCost?: number;
  /** Degree of parallelism (default 1). */
  parallelism?: number;
}

function argon2(algorithm: string, params: Argon2Params): Promise<Buffer> {
  const fn = (nodeCrypto as unknown as { argon2?: Argon2Fn }).argon2;
  if (typeof fn !== 'function') {
    throw new Error(
      '[ForgeTS] Argon2 password hashing requires Node.js 24.7 or newer (crypto.argon2 is unavailable).',
    );
  }
  return new Promise((resolve, reject) => {
    fn(algorithm, params, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/=+$/, '');

export class Hash {
  static readonly defaults: Required<HashOptions> = {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  };

  /**
   * Hash a plain-text password using Argon2id.
   *
   * @example
   * ```ts
   * const hashedPassword = await hash.make('secret123');
   * ```
   */
  static async make(plainPassword: string, options: HashOptions = {}): Promise<string> {
    if (typeof plainPassword !== 'string' || plainPassword.length === 0) {
      throw new TypeError('[ForgeTS] Hash.make() requires a non-empty password string.');
    }

    const memory = options.memoryCost ?? Hash.defaults.memoryCost;
    const passes = options.timeCost ?? Hash.defaults.timeCost;
    const parallelism = options.parallelism ?? Hash.defaults.parallelism;
    const nonce = randomBytes(16);

    const key = await argon2('argon2id', {
      message: plainPassword,
      nonce,
      parallelism,
      tagLength: 32,
      memory,
      passes,
    });

    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${b64(nonce)}$${b64(key)}`;
  }

  /**
   * Verify a plain-text password against a hashed password string.
   * Never throws: malformed or unsupported hashes simply return false.
   *
   * @example
   * ```ts
   * const isValid = await hash.verify('secret123', hashedPassword);
   * ```
   */
  static async verify(plainPassword: string, hashedPassword: string): Promise<boolean> {
    if (typeof plainPassword !== 'string' || typeof hashedPassword !== 'string') return false;
    if (!plainPassword || !hashedPassword) return false;

    try {
      if (hashedPassword.startsWith('$argon2')) {
        const parsed = Hash.parsePhc(hashedPassword);
        if (!parsed) return false;

        const key = await argon2(parsed.algorithm, {
          message: plainPassword,
          nonce: parsed.salt,
          parallelism: parsed.parallelism,
          tagLength: parsed.hash.length,
          memory: parsed.memory,
          passes: parsed.passes,
        });
        return key.length === parsed.hash.length && timingSafeEqual(key, parsed.hash);
      }

      // Legacy scrypt format written by earlier non-Bun fallbacks: scrypt:<salt>:<hex>
      if (hashedPassword.startsWith('scrypt:')) {
        const parts = hashedPassword.split(':');
        if (parts.length !== 3) return false;
        const [, salt, hashHex] = parts;
        const expected = Buffer.from(hashHex, 'hex');
        if (expected.length !== 64) return false;
        const derived = await scryptAsync(plainPassword, salt, 64);
        return timingSafeEqual(derived, expected);
      }
    } catch {
      return false;
    }

    return false;
  }

  /**
   * True when a stored hash was not produced with the current algorithm and
   * cost parameters and should be re-hashed on the user's next successful login.
   */
  static needsRehash(hashedPassword: string, options: HashOptions = {}): boolean {
    const parsed = typeof hashedPassword === 'string' ? Hash.parsePhc(hashedPassword) : null;
    if (!parsed || parsed.algorithm !== 'argon2id') return true;
    return (
      parsed.memory !== (options.memoryCost ?? Hash.defaults.memoryCost) ||
      parsed.passes !== (options.timeCost ?? Hash.defaults.timeCost) ||
      parsed.parallelism !== (options.parallelism ?? Hash.defaults.parallelism)
    );
  }

  private static parsePhc(encoded: string): {
    algorithm: string;
    memory: number;
    passes: number;
    parallelism: number;
    salt: Buffer;
    hash: Buffer;
  } | null {
    // $argon2id$v=19$m=65536,t=3,p=1$<salt>$<hash>
    const parts = encoded.split('$');
    if (parts.length !== 6 || parts[0] !== '') return null;
    const [, algorithm, version, paramText, saltB64, hashB64] = parts;
    if (!ARGON2_VARIANTS.has(algorithm) || version !== 'v=19') return null;

    const params: Record<string, number> = {};
    for (const pair of paramText.split(',')) {
      const [k, v] = pair.split('=');
      if (!/^\d+$/.test(v ?? '')) return null;
      params[k] = Number(v);
    }
    const { m: memory, t: passes, p: parallelism } = params;
    if (
      !Number.isInteger(memory) || !Number.isInteger(passes) || !Number.isInteger(parallelism) ||
      memory < 8 || memory > MAX_MEMORY_KIB ||
      passes < 1 || passes > MAX_PASSES ||
      parallelism < 1 || parallelism > MAX_PARALLELISM
    ) {
      return null;
    }

    const salt = Buffer.from(saltB64, 'base64');
    const hash = Buffer.from(hashB64, 'base64');
    if (salt.length < 8 || hash.length < 4) return null;

    return { algorithm, memory, passes, parallelism, salt, hash };
  }
}

/** Global hash helper singleton */
export const hash = Hash;
