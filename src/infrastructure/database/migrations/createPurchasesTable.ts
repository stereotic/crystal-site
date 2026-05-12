import { DatabaseConnection } from '../DatabaseConnection';

export async function createPurchasesTable(db: DatabaseConnection): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      price_cents INTEGER NOT NULL,
      purchased_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id)
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_purchases_card_id ON purchases(card_id)
  `);

  console.log('✅ Purchases table created');
}
