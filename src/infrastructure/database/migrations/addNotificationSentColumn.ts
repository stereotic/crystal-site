import { DatabaseConnection } from '../DatabaseConnection';
import { logger } from '../../logger';

export async function addNotificationSentColumn(db: DatabaseConnection): Promise<void> {
  try {
    // Check if column exists
    const tableInfo = await db.query<{ name: string }>(
      "PRAGMA table_info(deposit_requests)"
    );

    const columnExists = tableInfo.some(col => col.name === 'notification_sent');

    if (!columnExists) {
      await db.run(
        'ALTER TABLE deposit_requests ADD COLUMN notification_sent INTEGER DEFAULT 0'
      );
      logger.info('Added notification_sent column to deposit_requests table');
    } else {
      logger.info('notification_sent column already exists');
    }
  } catch (error) {
    logger.error('Error adding notification_sent column', { error });
    throw error;
  }
}
