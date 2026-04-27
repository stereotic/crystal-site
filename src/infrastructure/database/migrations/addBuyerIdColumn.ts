import { DatabaseConnection } from '../DatabaseConnection';

export async function addBuyerIdColumn(db: DatabaseConnection): Promise<void> {
  try {
    // Check if buyer_id column exists
    const tableInfo = await db.query<{ name: string }>(
      "PRAGMA table_info(cards)"
    );

    const hasBuyerId = tableInfo.some(col => col.name === 'buyer_id');

    if (!hasBuyerId) {
      await db.run(`
        ALTER TABLE cards ADD COLUMN buyer_id INTEGER;
      `);
      console.log('✅ Added buyer_id column to cards table');
    } else {
      console.log('ℹ️ buyer_id column already exists');
    }

    // Check if purchased_at column exists
    const hasPurchasedAt = tableInfo.some(col => col.name === 'purchased_at');

    if (!hasPurchasedAt) {
      await db.run(`
        ALTER TABLE cards ADD COLUMN purchased_at TEXT;
      `);
      console.log('✅ Added purchased_at column to cards table');
    } else {
      console.log('ℹ️ purchased_at column already exists');
    }
  } catch (error) {
    console.error('❌ Error adding buyer_id column:', error);
    throw error;
  }
}
