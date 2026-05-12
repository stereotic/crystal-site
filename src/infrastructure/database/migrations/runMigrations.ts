import { DatabaseConnection } from '../DatabaseConnection';
import { createUsersTable } from './createUsersTable';
import { createPurchasesTable } from './createPurchasesTable';
import { createDepositRequestsTable } from './createDepositRequestsTable';
import { addNotificationSentColumn } from './addNotificationSentColumn';
import { createPremiumMessagesTable } from './createPremiumMessagesTable';
import { addBuyerIdColumn } from './addBuyerIdColumn';
import { createCardsTable } from './createCardsTable';
import { createConversationsTable } from './createConversationsTable';
import { createChatMessagesTable } from './createChatMessagesTable';
import { ensureWalletsTable } from './ensureWalletsTable';

export async function runMigrations(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Running database migrations...');

  try {
    await createUsersTable(db);
    await createPurchasesTable(db);
    await createCardsTable(db);
    await createDepositRequestsTable(db);
    await addNotificationSentColumn(db);
    await createPremiumMessagesTable(db);
    await addBuyerIdColumn(db);
    await createConversationsTable(db);
    await createChatMessagesTable(db);
    await ensureWalletsTable(db);
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
