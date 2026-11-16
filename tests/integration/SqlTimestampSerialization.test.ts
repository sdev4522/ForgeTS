import { describe, test, expect } from '../harness.js';
import '../../bootstrap/app.js';
import { User } from '../../app/models/User.js';
import { getDatabaseConnection } from '../../packages/forge/src/database/Connection.js';

describe('SQL Datetime Serialization & MySQL Compatibility', () => {
  test('1. Model.create() formats created_at and updated_at for MySQL without T/Z ISO suffixes', async () => {
    const user = await User.create({
      name: 'Datetime Test User',
      email: `datetime_test_${Date.now()}@example.com`,
      password: 'password123',
    });

    expect(user.id).toBeDefined();
    expect(typeof user.created_at).toBe('string');
    expect(user.created_at).not.toContain('T');
    expect(user.created_at).not.toContain('Z');

    // Format should match YYYY-MM-DD HH:mm:ss(.sss)
    expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);

    // Verify row directly in MySQL
    const db = getDatabaseConnection();
    const row = await (db as any)
      .selectFrom('users')
      .selectAll()
      .where('id', '=', user.id)
      .executeTakeFirst();

    expect(row).toBeDefined();
    expect(row.created_at).toBeDefined();
  });

  test('2. Model sanitizes manually assigned ISO-8601 timestamps before SQL insert', async () => {
    const user = new User({
      name: 'ISO Sanitization User',
      email: `iso_test_${Date.now()}@example.com`,
      password: 'password123',
      created_at: '2026-09-19T17:18:46.094Z',
      updated_at: '2026-09-19T17:18:46.094Z',
    });

    // Should NOT throw MySQL error 1292: Incorrect datetime value
    await user.save();
    expect(user.id).toBeDefined();
    expect(user.created_at).not.toContain('T');
    expect(user.created_at).not.toContain('Z');
    expect(user.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
