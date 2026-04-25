import { DatabaseConnection } from '../DatabaseConnection';
import { createDepositRequestsTable } from './createDepositRequestsTable';

export async function runMigrations(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Running database migrations...');

  try {
    await createDepositRequestsTable(db);
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
