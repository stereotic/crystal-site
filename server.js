require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;

let db;

// Initialize database
async function initDatabase() {
  const SQL = await initSqlJs();

  let buffer;
  const dbPath = path.join(__dirname, 'database.db');

  if (fs.existsSync(dbPath)) {
    buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      balance_usd REAL DEFAULT 0,
      is_premium INTEGER DEFAULT 0,
      is_worker INTEGER DEFAULT 0,
      avatar TEXT DEFAULT 'fas fa-user-secret',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT NOT NULL,
      exp TEXT NOT NULL,
      cvv TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      region TEXT NOT NULL,
      type TEXT NOT NULL,
      bank TEXT,
      price_usd REAL NOT NULL,
      is_sold INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      card_id INTEGER NOT NULL,
      price_paid REAL NOT NULL,
      purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      wallet_address TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      wallet_address TEXT NOT NULL,
      wallet_currency TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      text TEXT,
      file_id TEXT,
      file_type TEXT,
      time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS premium_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      currency TEXT UNIQUE NOT NULL,
      address TEXT NOT NULL
    )
  `);

  // Insert demo wallets if not exist
  const walletCheck = db.exec('SELECT COUNT(*) as count FROM wallets');
  if (!walletCheck.length || walletCheck[0].values[0][0] === 0) {
    db.run("INSERT INTO wallets (currency, address) VALUES ('BTC', 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')");
    db.run("INSERT INTO wallets (currency, address) VALUES ('ETH', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')");
    db.run("INSERT INTO wallets (currency, address) VALUES ('USDT_TRC20', 'TXYZopYRdj2D9XRtbG4uTdhUZZ9JdDZsmo')");
    db.run("INSERT INTO wallets (currency, address) VALUES ('USDT_BEP20', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')");
  }

  // Insert demo cards if not exist
  const cardCheck = db.exec('SELECT COUNT(*) as count FROM cards');
  if (!cardCheck.length || cardCheck[0].values[0][0] === 0) {
    const demoCards = [
      ['4532015112830366', '12/28', '123', 'John Smith', 'USA', 'Standard', 'Chase Bank', 45],
      ['5425233430109903', '03/27', '456', 'Emma Wilson', 'UK', 'Gold', 'Barclays', 120],
      ['4916338506082832', '06/29', '789', 'Michael Brown', 'Canada', 'Platinum', 'RBC', 250],
      ['5105105105105100', '09/26', '321', 'Sarah Davis', 'Australia', 'Business', 'ANZ', 180],
      ['4024007134564842', '11/28', '654', 'David Lee', 'USA', 'Standard', 'Bank of America', 50],
      ['5555555555554444', '02/27', '987', 'Lisa Anderson', 'Germany', 'Gold', 'Deutsche Bank', 135],
    ];

    demoCards.forEach(card => {
      db.run('INSERT INTO cards (card_number, exp, cvv, holder_name, region, type, bank, price_usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', card);
    });
  }

  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(path.join(__dirname, 'database.db'), buffer);
}

// Helper functions
function queryOne(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length && result[0].values.length) {
    const columns = result[0].columns;
    const values = result[0].values[0];
    const obj = {};
    columns.forEach((col, i) => obj[col] = values[i]);
    return obj;
  }
  return null;
}

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  if (result.length && result[0].values.length) {
    const columns = result[0].columns;
    return result[0].values.map(values => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = values[i]);
      return obj;
    });
  }
  return [];
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'crystal-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  },
  rolling: true
}));

// Serve static files
app.use(express.static(__dirname));

// File upload setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ success: false, msg: 'Not authenticated' });
  next();
};

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || username.length < 3) {
      return res.json({ success: false, msg: 'Username must be at least 3 characters' });
    }

    if (!password || password.length < 6) {
      return res.json({ success: false, msg: 'Password must be at least 6 characters' });
    }

    const existingUser = queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.json({ success: false, msg: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email || null, hashedPassword]);
    saveDatabase();

    const user = queryOne('SELECT id, username, email, balance_usd, is_premium, is_worker FROM users WHERE username = ?', [username]);
    req.session.userId = user.id;

    // Сохраняем сессию явно перед отправкой ответа
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.json({ success: false, msg: 'Session error' });
      }

      res.json({ success: true, user });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, msg: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.json({ success: false, msg: 'Please provide login and password' });
    }

    const user = queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [login, login]);

    if (!user) {
      return res.json({ success: false, msg: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ success: false, msg: 'Invalid credentials' });
    }

    req.session.userId = user.id;

    // Сохраняем сессию явно перед отправкой ответа
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.json({ success: false, msg: 'Session error' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          balance_usd: user.balance_usd,
          is_premium: user.is_premium,
          is_worker: user.is_worker
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, msg: 'Login failed' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }

  const user = queryOne('SELECT id, username, email, balance_usd, is_premium, is_worker FROM users WHERE id = ?', [req.session.userId]);

  if (!user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    ...user
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.post('/api/auth/forgot', (req, res) => {
  res.json({ success: true, msg: 'Password reset link sent (demo)' });
});

app.post('/api/auth/send-code', (req, res) => {
  res.json({ success: true, msg: 'Verification code sent (demo)' });
});

// ==================== CARDS ROUTES ====================
app.get('/api/cards', (req, res) => {
  const { region, type } = req.query;

  let query = 'SELECT * FROM cards WHERE is_sold = 0';
  const params = [];

  if (region && region !== 'all') {
    query += ' AND region = ?';
    params.push(region);
  }

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }

  const cards = queryAll(query, params);
  res.json(cards);
});

app.get('/api/regions', (req, res) => {
  const regions = queryAll('SELECT DISTINCT region FROM cards').map(r => r.region);
  res.json(regions);
});

app.get('/api/my-cards', requireAuth, (req, res) => {
  const cards = queryAll(`
    SELECT c.* FROM cards c
    JOIN purchases p ON c.id = p.card_id
    WHERE p.user_id = ?
    ORDER BY p.purchased_at DESC
  `, [req.session.userId]);

  res.json(cards);
});

// ==================== PURCHASE ROUTES ====================
app.post('/api/cart/buy-now', requireAuth, async (req, res) => {
  try {
    const { cardId } = req.body;

    const card = queryOne('SELECT * FROM cards WHERE id = ? AND is_sold = 0', [cardId]);
    if (!card) {
      return res.json({ success: false, msg: 'Card not available' });
    }

    const user = queryOne('SELECT balance_usd FROM users WHERE id = ?', [req.session.userId]);

    if (user.balance_usd < card.price_usd) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    const newBalance = user.balance_usd - card.price_usd;

    db.run('UPDATE users SET balance_usd = ? WHERE id = ?', [newBalance, req.session.userId]);
    db.run('UPDATE cards SET is_sold = 1 WHERE id = ?', [cardId]);
    db.run('INSERT INTO purchases (user_id, card_id, price_paid) VALUES (?, ?, ?)', [req.session.userId, cardId, card.price_usd]);
    saveDatabase();

    res.json({ success: true, newBalance });
  } catch (error) {
    console.error('Purchase error:', error);
    res.json({ success: false, msg: 'Purchase failed' });
  }
});

// ==================== WALLET ROUTES ====================
app.get('/api/wallets', (req, res) => {
  const wallets = queryAll('SELECT * FROM wallets');
  res.json(wallets);
});

app.get('/api/rates', (req, res) => {
  res.json({
    BTC: 50000,
    ETH: 3000,
    USDT: 1
  });
});

// ==================== DEPOSIT ROUTES ====================
app.post('/api/deposit/request', requireAuth, (req, res) => {
  try {
    const { amount, currency } = req.body;

    const wallet = queryOne('SELECT address FROM wallets WHERE currency = ?', [currency]);

    db.run('INSERT INTO deposits (user_id, amount, currency, wallet_address) VALUES (?, ?, ?, ?)', [
      req.session.userId,
      amount,
      currency,
      wallet?.address || 'N/A'
    ]);
    saveDatabase();

    const deposit = queryOne('SELECT id FROM deposits WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.session.userId]);

    res.json({
      success: true,
      requestId: deposit.id,
      walletAddress: wallet?.address || 'N/A'
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    res.json({ success: false, msg: 'Deposit request failed' });
  }
});

app.post('/api/deposit/check', requireAuth, (req, res) => {
  const { requestId } = req.body;

  const deposit = queryOne('SELECT status FROM deposits WHERE id = ? AND user_id = ?', [requestId, req.session.userId]);

  if (!deposit) {
    return res.json({ status: 'not_found' });
  }

  res.json({ status: deposit.status });
});

// ==================== WITHDRAWAL ROUTES ====================
app.post('/api/withdraw/request', requireAuth, async (req, res) => {
  try {
    const { amount, wallet_address, wallet_currency, password } = req.body;

    const user = queryOne('SELECT * FROM users WHERE id = ?', [req.session.userId]);

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ success: false, msg: 'Invalid password' });
    }

    if (user.balance_usd < amount) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    db.run('INSERT INTO withdrawals (user_id, amount, wallet_address, wallet_currency) VALUES (?, ?, ?, ?)', [
      req.session.userId,
      amount,
      wallet_address,
      wallet_currency
    ]);
    saveDatabase();

    res.json({ success: true });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.json({ success: false, msg: 'Withdrawal request failed' });
  }
});

// ==================== PREMIUM ROUTES ====================
app.post('/api/user/buy-premium', requireAuth, (req, res) => {
  try {
    const user = queryOne('SELECT balance_usd, is_premium FROM users WHERE id = ?', [req.session.userId]);

    if (user.is_premium) {
      return res.json({ success: false, msg: 'Already premium' });
    }

    if (user.balance_usd < 220) {
      return res.json({ success: false, msg: 'Insufficient balance' });
    }

    const newBalance = user.balance_usd - 220;

    db.run('UPDATE users SET balance_usd = ?, is_premium = 1 WHERE id = ?', [newBalance, req.session.userId]);
    saveDatabase();

    res.json({ success: true, newBalance });
  } catch (error) {
    console.error('Premium purchase error:', error);
    res.json({ success: false, msg: 'Premium purchase failed' });
  }
});

app.get('/api/premium/messages', requireAuth, (req, res) => {
  const user = queryOne('SELECT is_premium FROM users WHERE id = ?', [req.session.userId]);

  if (!user.is_premium) {
    return res.json([]);
  }

  const messages = queryAll('SELECT * FROM premium_messages ORDER BY time ASC LIMIT 100');
  res.json(messages);
});

app.post('/api/premium/send', requireAuth, (req, res) => {
  try {
    const { message } = req.body;

    const user = queryOne('SELECT username, is_premium FROM users WHERE id = ?', [req.session.userId]);

    if (!user.is_premium) {
      return res.json({ success: false, msg: 'Premium only' });
    }

    db.run('INSERT INTO premium_messages (user_id, username, message) VALUES (?, ?, ?)', [
      req.session.userId,
      user.username,
      message
    ]);
    saveDatabase();

    res.json({ success: true });
  } catch (error) {
    console.error('Premium message error:', error);
    res.json({ success: false, msg: 'Failed to send message' });
  }
});

// ==================== ORDERS ROUTES ====================
app.post('/api/orders/generate', requireAuth, (req, res) => {
  const user = queryOne('SELECT is_premium FROM users WHERE id = ?', [req.session.userId]);

  if (!user.is_premium) {
    return res.json({ success: false, msg: 'Premium only' });
  }

  const balance = (Math.random() * 5000 + 100).toFixed(2);
  res.json({ success: true, balance });
});

// ==================== SUPPORT ROUTES ====================
app.get('/api/support/history', requireAuth, (req, res) => {
  const messages = queryAll('SELECT * FROM support_messages WHERE user_id = ? ORDER BY time ASC', [req.session.userId]);
  res.json(messages);
});

app.post('/api/support/send', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;

    db.run('INSERT INTO support_messages (user_id, role, text) VALUES (?, ?, ?)', [
      req.session.userId,
      'user',
      message
    ]);
    saveDatabase();

    // Отправляем сообщение в Telegram бот
    const user = queryOne('SELECT username, email FROM users WHERE id = ?', [req.session.userId]);

    try {
      const botResponse = await fetch('http://localhost:3001/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.WEBHOOK_SECRET || '7e18b08fe0d112d97865caf050dc6268ccb6c29df933f1b9b3d97ae36c7b5132',
          userId: req.session.userId.toString(),
          userName: user.username,
          userEmail: user.email || 'Не указан',
          message: message
        })
      });

      if (!botResponse.ok) {
        console.error('Failed to send to bot:', await botResponse.text());
      }
    } catch (botError) {
      console.error('Bot notification error:', botError.message);
      // Не прерываем работу, если бот недоступен
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Support message error:', error);
    res.json({ success: false, msg: 'Failed to send message' });
  }
});

app.post('/api/support/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, msg: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    db.run('INSERT INTO support_messages (user_id, role, file_id, file_type) VALUES (?, ?, ?, ?)', [
      req.session.userId,
      'user',
      fileUrl,
      req.file.mimetype
    ]);
    saveDatabase();

    // Уведомляем бот о загрузке файла
    const user = queryOne('SELECT username, email FROM users WHERE id = ?', [req.session.userId]);

    try {
      const fullFilePath = path.join(__dirname, 'uploads', req.file.filename);

      await fetch('http://localhost:3001/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: process.env.WEBHOOK_SECRET || '7e18b08fe0d112d97865caf050dc6268ccb6c29df933f1b9b3d97ae36c7b5132',
          userId: req.session.userId.toString(),
          userName: user.username,
          userEmail: user.email || 'Не указан',
          message: `📎 ${req.file.originalname}`,
          fileType: req.file.mimetype,
          filePath: fullFilePath
        })
      });
    } catch (botError) {
      console.error('Bot notification error:', botError.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('File upload error:', error);
    res.json({ success: false, msg: 'Upload failed' });
  }
});

// Endpoint для получения ответов от бота
app.post('/api/support/bot-reply', async (req, res) => {
  try {
    const { secret, userId, message } = req.body;

    // Проверяем секретный ключ
    if (secret !== (process.env.WEBHOOK_SECRET || '7e18b08fe0d112d97865caf050dc6268ccb6c29df933f1b9b3d97ae36c7b5132')) {
      return res.status(403).json({ success: false, msg: 'Invalid secret' });
    }

    // Добавляем ответ админа в базу
    db.run('INSERT INTO support_messages (user_id, role, text) VALUES (?, ?, ?)', [
      parseInt(userId),
      'admin',
      message
    ]);
    saveDatabase();

    res.json({ success: true });
  } catch (error) {
    console.error('Bot reply error:', error);
    res.status(500).json({ success: false, msg: 'Failed to save reply' });
  }
});

// ==================== REF ROUTES ====================
app.post('/api/ref/set', (req, res) => {
  res.json({ success: true });
});

// Serve uploads
app.use('/uploads', express.static(uploadDir));

// Start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📂 Database: database.db`);
    console.log(`🚀 Open http://localhost:${PORT} in your browser`);
  });
});
