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
    { currency: 'BTC', address: 'bc1qc4c7ykn8w56xk3q6kkg34yz2echja5lsj5vvp7' },
    { currency: 'ETH', address: '0x76d3f5091519926370a1C2640f69Ad55b7537543' },
    { currency: 'USDT_TRC20', address: 'TFd6AgsoPjMZRczqUkW2GNKAooorcdf4z2' },
    { currency: 'USDT_BEP20', address: '0x906EB7d8963F0101c0464B0097255ca6bf149A4a' }
  ];

  for (const wallet of wallets) {
    await db.run(
      `INSERT OR IGNORE INTO wallets (currency, address) VALUES (?, ?)`,
      [wallet.currency, wallet.address]
    );
  }

  console.log('✅ wallets table ensured successfully');
}
