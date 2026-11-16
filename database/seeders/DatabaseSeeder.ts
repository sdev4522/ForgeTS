import type { Kysely } from 'kysely';

/**
 * Root database seeder.
 * Run with: forge db:seed   (or: forge migrate:fresh --seed)
 */
export default async function run(_db: Kysely<any>): Promise<void> {
  // Example:
  // await _db.insertInto('users').values({ name: 'Admin', email: 'admin@example.com', password: await Hash.make('change-me') }).execute();
}
