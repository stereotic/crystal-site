import { DatabaseConnection } from '../DatabaseConnection';

export async function createUsersTable(db: DatabaseConnection): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password TEXT NOT NULL,
      balance_cents INTEGER DEFAULT 0,
      is_premium INTEGER DEFAULT 0,
      is_worker INTEGER DEFAULT 0,
      banned INTEGER DEFAULT 0,
      tg_id TEXT,
      tg_username TEXT,
      worker_id TEXT,
      partner_id TEXT,
      referrer_tg_id TEXT,
      ref_code TEXT,
      created INTEGER NOT NULL,
      lastLogin INTEGER
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id)
  `);

  console.log('✅ Users table created');
}
