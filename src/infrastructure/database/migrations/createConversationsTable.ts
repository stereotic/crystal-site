import { DatabaseConnection } from '../DatabaseConnection';

export async function createConversationsTable(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Creating conversations table...');

  await db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_identifier TEXT NOT NULL,
      chat_type TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      last_message_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      closed_at INTEGER
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_conversations_user
    ON conversations(user_identifier, chat_type, status)
  `);

  console.log('✅ conversations table created successfully');
}
