import { DatabaseConnection } from '../DatabaseConnection';
import { createDepositRequestsTable } from './createDepositRequestsTable';
import { addNotificationSentColumn } from './addNotificationSentColumn';
import { createPremiumMessagesTable } from './createPremiumMessagesTable';
import { addBuyerIdColumn } from './addBuyerIdColumn';

export async function runMigrations(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Running database migrations...');

  try {
    await createDepositRequestsTable(db);
    await addNotificationSentColumn(db);
    await createPremiumMessagesTable(db);
    await addBuyerIdColumn(db);
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
