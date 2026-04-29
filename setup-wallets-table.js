const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Create wallets table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating wallets table:', err);
    } else {
      console.log('✅ Wallets table created or already exists');
    }
  });

  // Check existing wallets
  db.all('SELECT * FROM wallets', (err, rows) => {
    if (err) {
      console.error('Error reading wallets:', err);
    } else {
      console.log('\n📋 Current wallets:');
      if (rows.length === 0) {
        console.log('No wallets configured yet');
      } else {
        rows.forEach(wallet => {
          console.log(`  ${wallet.currency}: ${wallet.address}`);
        });
      }
    }
    db.close();
  });
});
