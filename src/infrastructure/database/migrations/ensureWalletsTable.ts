import { DatabaseConnection } from '../DatabaseConnection';

export async function ensureWalletsTable(db: DatabaseConnection): Promise<void> {
  console.log('🔄 Ensuring wallets table exists...');

  await db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL
    )
  `);

  // Insert default wallets if they don't exist
  const wallets = [
    { currency: 'BTC', address: 'bc1qhpycck5t3mdhlztsj8exx62l34r7rp7ulfk6hz' },
    { currency: 'ETH', address: '0x89FA8bf2da91b83e4Bb6071Ff7cAf00E1f2360EF' },
    { currency: 'USDT_TRC20', address: 'TMurDrJFSJ5binxbND5BPseg6c6ukjwTxB' },
    { currency: 'USDT_BEP20', address: '0x89FA8bf2da91b83e4Bb6071Ff7cAf00E1f2360EF' }
  ];

  for (const wallet of wallets) {
    await db.run(
      `INSERT OR IGNORE INTO wallets (currency, address) VALUES (?, ?)`,
      [wallet.currency, wallet.address]
    );
  }

  console.log('✅ wallets table ensured successfully');
}
