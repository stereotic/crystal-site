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
import { TelegramSupportBot, TelegramControlBot } from './infrastructure/telegram';

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
    if (!origin || allowedOrigins.includes(origin)) {
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
    secure: configService.isProduction(),
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

// Static files
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API routes
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/deposit', depositRoutes);

// Telegram webhook endpoint for control bot
app.post('/webhook/control-bot', express.json(), async (req, res) => {
  try {
    const { TelegramControlBot } = await import('./infrastructure/telegram');
    const controlBot = container.resolve(TelegramControlBot);
    await controlBot.handleUpdate(req.body);
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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

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
    logger.info('Starting Telegram bots...');
    try {
      const telegramBot = container.resolve(TelegramSupportBot);
      logger.info('TelegramSupportBot resolved from container');
      await telegramBot.start();
      logger.info('✅ Telegram support bot started in polling mode');

      const controlBot = container.resolve(TelegramControlBot);
      logger.info('TelegramControlBot resolved from container');
      await controlBot.start();
      logger.info('✅ Telegram control bot started in polling mode');
    } catch (error) {
      logger.error('❌ Failed to start Telegram bots', {
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
  const telegramBot = container.resolve(TelegramSupportBot);
  telegramBot.stop();
  const controlBot = container.resolve(TelegramControlBot);
  controlBot.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  const telegramBot = container.resolve(TelegramSupportBot);
  telegramBot.stop();
  const controlBot = container.resolve(TelegramControlBot);
  controlBot.stop();
  process.exit(0);
});

export default app;
