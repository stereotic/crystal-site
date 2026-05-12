import { DatabaseConnection } from '../DatabaseConnection';

export async function createCardsTable(db: DatabaseConnection): Promise<void> {
  try {
    // Create cards table
    await db.run(`
      CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT NOT NULL,
        type TEXT NOT NULL,
        card_number TEXT NOT NULL,
        exp TEXT NOT NULL,
        holder_name TEXT NOT NULL,
        cvv TEXT NOT NULL,
        bank TEXT NOT NULL,
        bin TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        is_sold INTEGER DEFAULT 0,
        buyer_id TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        sold_at INTEGER,
        FOREIGN KEY (buyer_id) REFERENCES users(id)
      )
    `);

    // Create indexes
    await db.run('CREATE INDEX IF NOT EXISTS idx_cards_region ON cards(region)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(type)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cards_is_active ON cards(is_active)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cards_is_sold ON cards(is_sold)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_cards_buyer_id ON cards(buyer_id)');

    console.log('✅ cards table created successfully');
  } catch (error) {
    console.error('❌ Error creating cards table:', error);
    throw error;
  }
}
