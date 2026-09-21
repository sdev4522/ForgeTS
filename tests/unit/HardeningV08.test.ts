// tests/unit/HardeningV08.test.ts
// ─────────────────────────────────────────────────────────────────────
// Pre-v0.8 Production Hardening Test Suite.
// Verifies:
// 1. Column decorator works with TC39 Stage 3 metadata on standard fields.
// 2. Model hydration works with non-declare properties.
// 3. ErrorDisplayEngine.renderJson facade generates structured debug payload.
// 4. Database configuration contains only supported production drivers (MySQL, MongoDB).
// ─────────────────────────────────────────────────────────────────────

import '../../packages/forge/src/polyfills.js';
import { describe, test, expect } from 'bun:test';
import { Model, Column, MODEL_COLUMNS } from '../../packages/forge/src/database/index.js';
import { ErrorDisplayEngine } from '../../packages/forge/src/http/ErrorDisplayEngine.js';
import dbConfig from '../../config/database.js';

class HardenedProduct extends Model {
  static override table = 'products';
  static override fillable = ['title', 'price', 'in_stock'];

  @Column() id!: number;
  @Column() title!: string;
  @Column() price!: number;
  @Column() in_stock!: boolean;
}

describe('Pre-v0.8 Production Hardening Suite', () => {
  test('1. Column decorator records property names in Symbol.metadata without declare keyword', () => {
    const metadata = (HardenedProduct as any)[Symbol.metadata as any];
    expect(metadata).toBeDefined();

    const columns: Array<string | symbol> = metadata[MODEL_COLUMNS];
    expect(columns).toBeDefined();
    expect(columns).toContain('id');
    expect(columns).toContain('title');
    expect(columns).toContain('price');
    expect(columns).toContain('in_stock');
  });

  test('2. Model instantiation and hydration work with hardened class fields', () => {
    const product = HardenedProduct.hydrate<HardenedProduct>({
      id: 99,
      title: 'ForgeTS Pro',
      price: 199,
      in_stock: true,
    });

    expect(product.id).toBe(99);
    expect(product.title).toBe('ForgeTS Pro');
    expect(product.price).toBe(199);
    expect(product.in_stock).toBe(true);
    expect(product.toJSON()).toEqual({
      id: 99,
      title: 'ForgeTS Pro',
      price: 199,
      in_stock: true,
    });
  });

  test('3. ErrorDisplayEngine.renderJson produces structured debug JSON payload', () => {
    const sampleError = new Error('Test hardening error');
    const result: any = ErrorDisplayEngine.renderJson(sampleError, 'http://localhost:3000/api/test');

    expect(result).toBeDefined();
    expect(result.message).toBe('Test hardening error');
    expect(result.request).toBeDefined();
    expect(result.request.path).toBe('/api/test');
  });

  test('4. Database configuration contains only supported production drivers (no dead postgres config)', () => {
    expect(dbConfig.default).toBeDefined();
    expect(dbConfig.connections).toBeDefined();
    expect(dbConfig.connections.mysql).toBeDefined();
    expect(dbConfig.connections.mysql.driver).toBe('mysql');
    expect(dbConfig.connections.mongodb).toBeDefined();
    expect(dbConfig.connections.mongodb.driver).toBe('mongodb');
    expect((dbConfig.connections as any).postgres).toBeUndefined();
  });
});
