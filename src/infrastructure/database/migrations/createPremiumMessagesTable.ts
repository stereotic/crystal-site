import { DatabaseConnection } from '../DatabaseConnection';

export async function createPremiumMessagesTable(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Creating premium_messages table...');

  await db.run(`
    CREATE TABLE IF NOT EXISTS premium_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('✅ premium_messages table created successfully');
}
