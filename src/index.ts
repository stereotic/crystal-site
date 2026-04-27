import 'reflect-metadata';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { configService } from '../config';
import { logger } from './infrastructure/logger';
import { errorHandler } from './presentation/middleware/errorHandler';
import { authRoutes, cardRoutes, supportRoutes, depositRoutes } from './presentation/http';
import './container'; // Initialize DI container
import { container } from './container';
import { TelegramUnifiedBot } from './infrastructure/telegram';

const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const config = configService.get();

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const allowedOrigins = [
  config.domain,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all origins
    if (config.nodeEnv === 'development') {
      callback(null, true);
    } else if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  name: 'crystal.sid',
  secret: config.sessionSecret,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  unset: 'destroy',
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: process.cwd(),
  }),
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: false, // Disable secure in development to fix session issues
    sameSite: 'lax',
  },
  proxy: true,
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { success: false, message: 'Too many login attempts' },
});

// API routes (BEFORE static files)
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/deposit', depositRoutes);

// Telegram webhook endpoint for unified bot
app.post('/webhook/telegram-bot', express.json(), async (req, res) => {
  try {
    const { TelegramUnifiedBot } = await import('./infrastructure/telegram');
    const unifiedBot = container.resolve(TelegramUnifiedBot);
    await unifiedBot.handleUpdate(req.body);
    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook error', { error });
    res.sendStatus(500);
  }
});

// Wallets endpoint
app.get('/api/wallets', async (req, res, next) => {
  try {
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);
    const wallets = await db.query<{ id: number; currency: string; address: string }>(
      'SELECT id, currency, address FROM wallets'
    );
    res.json(wallets);
  } catch (error) {
    next(error);
  }
});

// Rates endpoint
app.get('/api/rates', async (req, res, next) => {
  try {
    res.json({
      BTC: 50000,
      ETH: 3000,
      USDT: 1
    });
  } catch (error) {
    next(error);
  }
  return;
});

// Regions endpoint
app.get('/api/regions', async (req, res, next) => {
  try {
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);
    const regions = await db.query<{ region: string }>(
      'SELECT DISTINCT region FROM cards WHERE is_sold = 0'
    );
    res.json(regions.map(r => r.region));
  } catch (error) {
    next(error);
  }
  return;
});

// Get available cards for shop
app.get('/api/cards/available', async (req, res, next) => {
  try {
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Get only active cards
    const cards = await db.query<any>(
      'SELECT id, region, type, card_number, exp, holder_name, bank, bin, price_cents FROM cards WHERE is_active = 1 ORDER BY created_at DESC LIMIT 100',
      []
    );

    // Convert price_cents to price_usd for frontend
    const cardsWithUsd = cards.map(card => ({
      ...card,
      price_usd: card.price_cents / 100
    }));

    res.json(cardsWithUsd);
  } catch (error) {
    next(error);
  }
});

// My cards endpoint
app.get('/api/my-cards', async (req, res, next) => {
  try {
    console.log('[my-cards] Request from user:', req.session.userId);

    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Get purchased demo cards from purchases table
    const purchases = await db.query<any>(
      'SELECT card_id, price_cents, purchased_at FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC',
      [req.session.userId]
    );

    console.log('[my-cards] Purchases found:', purchases.length);

    // Demo card data
    const demoCardData: { [key: number]: any } = {
      1: { card_number: '4532015112830366', exp: '12/28', cvv: '123', holder_name: 'John Smith', region: 'USA', type: 'Standard', bank: 'Chase' },
      2: { card_number: '5425233430109903', exp: '03/27', cvv: '456', holder_name: 'Emma Wilson', region: 'UK', type: 'Gold', bank: 'Barclays' },
      3: { card_number: '4916338506082832', exp: '06/29', cvv: '789', holder_name: 'Michael Brown', region: 'Canada', type: 'Platinum', bank: 'RBC' },
      4: { card_number: '4024007135295100', exp: '09/26', cvv: '321', holder_name: 'Sarah Davis', region: 'Australia', type: 'Business', bank: 'ANZ' },
      5: { card_number: '5191914144144842', exp: '11/28', cvv: '654', holder_name: 'David Lee', region: 'USA', type: 'Standard', bank: 'Wells Fargo' },
      6: { card_number: '4485394441234444', exp: '02/27', cvv: '987', holder_name: 'Lisa Anderson', region: 'Germany', type: 'Gold', bank: 'Deutsche Bank' }
    };

    const myCards = purchases.map(p => {
      const demoData = demoCardData[p.card_id];
      if (demoData) {
        return {
          id: p.card_id,
          ...demoData,
          price_usd: p.price_cents / 100,
          purchased_at: p.purchased_at
        };
      }
      return null;
    }).filter(c => c !== null);

    console.log('[my-cards] Demo cards mapped:', myCards.length);

    // Also get real cards from cards table
    const realCards = await db.query<any>(
      'SELECT * FROM cards WHERE buyer_id = ? ORDER BY purchased_at DESC',
      [req.session.userId]
    );

    console.log('[my-cards] Real cards found:', realCards.length);
    console.log('[my-cards] Total cards returning:', myCards.length + realCards.length);

    res.json([...myCards, ...realCards]);
  } catch (error) {
    console.error('[my-cards] Error:', error);
    next(error);
  }
  return;
});

// Cart buy-now endpoint
app.post('/api/cart/buy-now', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { cardId } = req.body;

    console.log('[buy-now] Request:', { userId: req.session.userId, cardId, cardIdType: typeof cardId });

    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Demo card prices (always available)
    const demoCardPrices: { [key: number]: number } = {
      1: 45,
      2: 120,
      3: 250,
      4: 180,
      5: 50,
      6: 135
    };

    // Convert cardId to number
    const cardIdNum = parseInt(cardId);

    // Check if it's a demo card
    if (demoCardPrices[cardIdNum]) {
      const priceUsd = demoCardPrices[cardIdNum];
      const priceCents = priceUsd * 100;

      console.log('[buy-now] Demo card purchase:', { cardIdNum, priceUsd, priceCents });

      // Get user
      const users = await db.query<any>('SELECT * FROM users WHERE id = ?', [req.session.userId]);
      if (users.length === 0) {
        return res.json({ success: false, msg: 'User not found' });
      }
      const user = users[0];

      // Handle null balance
      const userBalanceCents = user.balance_cents || 0;

      console.log('[buy-now] User balance:', { userBalanceCents, priceCents, sufficient: userBalanceCents >= priceCents });

      // Check balance
      if (userBalanceCents < priceCents) {
        return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
      }

      // Update balance (no need to mark card as sold for demo cards)
      const newBalanceCents = userBalanceCents - priceCents;
      await db.run('UPDATE users SET balance_cents = ? WHERE id = ?', [newBalanceCents, user.id]);

      // Save purchase record
      await db.run(
        'INSERT INTO purchases (user_id, card_id, price_cents, purchased_at) VALUES (?, ?, ?, ?)',
        [user.id, cardIdNum, priceCents, Date.now()]
      );

      console.log('[buy-now] Purchase successful:', { newBalanceCents });

      return res.json({ success: true, newBalance: newBalanceCents / 100 });
    }

    // For real cards from database
    const cards = await db.query<any>('SELECT * FROM cards WHERE id = ? AND is_active = 1', [cardIdNum]);
    if (cards.length === 0) {
      return res.json({ success: false, msg: 'Card not available' });
    }
    const card = cards[0];

    // Get user
    const users = await db.query<any>('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0) {
      return res.json({ success: false, msg: 'User not found' });
    }
    const user = users[0];

    // Handle null balance
    const userBalanceCents = user.balance_cents || 0;

    // Use price_cents from card
    const priceCents = card.price_cents;

    // Check balance (use balance_cents)
    if (userBalanceCents < priceCents) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    // Update balance and card
    const newBalanceCents = userBalanceCents - priceCents;
    await db.run('UPDATE users SET balance_cents = ? WHERE id = ?', [newBalanceCents, user.id]);
    await db.run('UPDATE cards SET is_active = 0, buyer_id = ?, purchased_at = ? WHERE id = ?',
      [user.id, Date.now(), cardIdNum]);

    res.json({ success: true, newBalance: newBalanceCents / 100 });
  } catch (error) {
    console.error('[buy-now] Error:', error);
    next(error);
  }
  return;
});

// User buy premium endpoint
app.post('/api/user/buy-premium', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    const users = await db.query<any>('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0) {
      return res.json({ success: false, msg: 'User not found' });
    }
    const user = users[0];

    if (user.is_premium) {
      return res.json({ success: false, msg: 'Already premium' });
    }

    const premiumPriceCents = 220 * 100; // $220 in cents
    if (user.balance_cents < premiumPriceCents) {
      return res.json({ success: false, msg: 'Insufficient balance' });
    }

    const newBalanceCents = user.balance_cents - premiumPriceCents;
    await db.run('UPDATE users SET balance_cents = ?, is_premium = 1 WHERE id = ?', [newBalanceCents, user.id]);

    res.json({ success: true, newBalance: newBalanceCents / 100 });
  } catch (error) {
    next(error);
  }
  return;
});

// Premium messages endpoint
app.get('/api/premium/messages', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Get messages ONLY for current user (both user messages and admin replies to this user)
    const messages = await db.query<any>(
      'SELECT * FROM premium_messages WHERE user_id = ? ORDER BY time ASC LIMIT 100',
      [req.session.userId]
    );
    res.json(messages.map((m: any) => ({
      username: m.username || 'Anonymous',
      message: m.message,
      time: m.time,
      isAdmin: m.username === 'Admin'
    })));
  } catch (error) {
    next(error);
  }
  return;
});

// Premium send message endpoint
app.post('/api/premium/send', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { message } = req.body;

    console.log('[premium/send] Request:', { userId: req.session.userId, messageLength: message?.length });

    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Get user info
    const users = await db.query<any>('SELECT username FROM users WHERE id = ?', [req.session.userId]);
    const username = users.length > 0 ? users[0].username : 'Anonymous';

    // Insert message
    await db.run(
      'INSERT INTO premium_messages (user_id, username, message, time) VALUES (?, ?, ?, ?)',
      [req.session.userId, username, message, new Date().toISOString()]
    );

    console.log('[premium/send] Message saved to DB');

    // Send notification to Telegram bot
    try {
      const { TelegramUnifiedBot } = await import('./infrastructure/telegram');
      const bot = container.resolve(TelegramUnifiedBot);
      await bot.notifyPremiumMessage(req.session.userId, username, message);
      console.log('[premium/send] Notification sent to Telegram');
    } catch (botError) {
      console.error('Failed to send Telegram notification:', botError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[premium/send] Error:', error);
    next(error);
  }
  return;
});

// Orders generate endpoint (premium feature)
app.post('/api/orders/generate', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    const users = await db.query<any>('SELECT is_premium FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0 || !users[0].is_premium) {
      return res.json({ success: false, msg: 'Premium required' });
    }

    // Generate random balance
    const balance = (Math.random() * 5000 + 100).toFixed(2);
    res.json({ success: true, balance });
  } catch (error) {
    next(error);
  }
  return;
});

// Withdraw request endpoint
app.post('/api/withdraw/request', async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }
    const { amount, wallet_address, wallet_currency, password } = req.body;
    const { DatabaseConnection } = await import('./infrastructure/database');
    const db = container.resolve(DatabaseConnection);

    // Verify password
    const users = await db.query<any>('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (users.length === 0) {
      return res.json({ success: false, msg: 'User not found' });
    }
    const user = users[0];

    const bcrypt = require('bcrypt');
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.json({ success: false, msg: 'Invalid password' });
    }

    if (user.balance_usd < amount) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    // Create withdraw request
    await db.run(
      'INSERT INTO withdraw_requests (user_id, amount_usd, wallet_address, wallet_currency, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, amount, wallet_address, wallet_currency, 'pending', new Date().toISOString()]
    );

    res.json({ success: true, msg: 'Withdraw request submitted' });
  } catch (error) {
    next(error);
  }
  return;
});

// Referral set endpoint
app.post('/api/ref/set', async (req, res, next) => {
  try {
    const { ref } = req.body;
    // Store in session for later use during registration
    (req.session as any).referralCode = ref;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
  return;
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Static files (AFTER all API routes)
// Use process.cwd() to get project root, works both in dev and production
app.use(express.static(path.join(process.cwd(), 'public')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Error handling
app.use(errorHandler);

// SPA fallback - serve index.html for all non-API routes (must be last)
app.get('*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Start server
const PORT = config.port;

app.listen(PORT, async () => {
  logger.info(`🚀 Server started on port ${PORT}`);
  logger.info(`📍 Environment: ${config.nodeEnv}`);
  logger.info(`🌐 Domain: ${config.domain}`);

  // Start Telegram bot (only in development, not in serverless)
  logger.info('Checking bot startup conditions', {
    isProduction: configService.isProduction(),
    enableBotPolling: process.env.ENABLE_BOT_POLLING,
    nodeEnv: config.nodeEnv
  });

  if (!configService.isProduction() || process.env.ENABLE_BOT_POLLING === 'true') {
    logger.info('Starting Unified Telegram Bot...');
    try {
      const unifiedBot = container.resolve(TelegramUnifiedBot);
      logger.info('TelegramUnifiedBot resolved from container');
      await unifiedBot.start();
      logger.info('✅ Unified Telegram Bot started successfully');
    } catch (error) {
      logger.error('❌ Failed to start Unified Telegram Bot', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  } else {
    logger.info('ℹ️ Telegram bot polling disabled in production (use webhooks or separate bot service)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  const unifiedBot = container.resolve(TelegramUnifiedBot);
  unifiedBot.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  const unifiedBot = container.resolve(TelegramUnifiedBot);
  unifiedBot.stop();
  process.exit(0);
});

export default app;
