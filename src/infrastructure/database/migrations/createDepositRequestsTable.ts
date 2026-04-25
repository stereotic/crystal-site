import { DatabaseConnection } from '../DatabaseConnection';

export async function createDepositRequestsTable(db: DatabaseConnection): Promise<void> {
  try {
    // Create deposit_requests table
    await db.run(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create indexes
    await db.run('CREATE INDEX IF NOT EXISTS idx_deposit_requests_user_id ON deposit_requests(user_id)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_deposit_requests_status ON deposit_requests(status)');

    console.log('✅ deposit_requests table created successfully');
  } catch (error) {
    console.error('❌ Error creating deposit_requests table:', error);
    throw error;
  }
}
