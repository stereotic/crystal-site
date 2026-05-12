import { DatabaseConnection } from '../DatabaseConnection';

export async function createChatMessagesTable(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Creating chat_messages table...');

  await db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      message TEXT NOT NULL,
      telegram_message_id INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `);

  await db.run(`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
    ON chat_messages(conversation_id, created_at)
  `);

  console.log('✅ chat_messages table created successfully');
}
