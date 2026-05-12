import { DatabaseConnection } from '../DatabaseConnection';

export async function createPremiumMessagesTable(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Creating premium_messages table...');

  await db.run(`
    CREATE TABLE IF NOT EXISTS premium_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      time TEXT NOT NULL
    )
  `);

  console.log('✅ premium_messages table created successfully');
}
