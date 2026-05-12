import { DatabaseConnection } from '../DatabaseConnection';
import { logger } from '../../logger';

export async function createMessagesTable(db: DatabaseConnection): Promise<void> {
  try {
    logger.info('🔄 Creating messages table...');

    await db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        file_id TEXT,
        file_type TEXT,
        time INTEGER NOT NULL
      )
    `);

    logger.info('✅ messages table created successfully');
  } catch (error) {
    logger.error('❌ Failed to create messages table', { error });
    throw error;
  }
}
