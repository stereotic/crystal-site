const bcrypt = require('bcryptjs');

// In-memory storage (для демо, в продакшене используйте базу данных)
// Тестовый пользователь: qwerty / qwerty12345 (ADMIN)
let users = [
  {
    id: 1,
    username: 'qwerty',
    email: null,
    password: '$2a$10$xd3jGrlUI3DlukYcylJfjOgzJGEY5TtFFK2OK7CiSPe0e8luGwUG2',
    balance_usd: 0,
    is_premium: 0,
    is_worker: 1,
    created_at: new Date().toISOString()
  }
];
let cards = [
  { id: 1, card_number: '4532015112830366', exp: '12/28', cvv: '123', holder_name: 'John Smith', region: 'USA', type: 'Standard', bank: 'Chase Bank', price_usd: 45, is_sold: 0 },
  { id: 2, card_number: '5425233430109903', exp: '03/27', cvv: '456', holder_name: 'Emma Wilson', region: 'UK', type: 'Gold', bank: 'Barclays', price_usd: 120, is_sold: 0 },
  { id: 3, card_number: '4916338506082832', exp: '06/29', cvv: '789', holder_name: 'Michael Brown', region: 'Canada', type: 'Platinum', bank: 'RBC', price_usd: 250, is_sold: 0 },
  { id: 4, card_number: '5105105105105100', exp: '09/26', cvv: '321', holder_name: 'Sarah Davis', region: 'Australia', type: 'Business', bank: 'ANZ', price_usd: 180, is_sold: 0 },
  { id: 5, card_number: '4024007134564842', exp: '11/28', cvv: '654', holder_name: 'David Lee', region: 'USA', type: 'Standard', bank: 'Bank of America', price_usd: 50, is_sold: 0 },
  { id: 6, card_number: '5555555555554444', exp: '02/27', cvv: '987', holder_name: 'Lisa Anderson', region: 'Germany', type: 'Gold', bank: 'Deutsche Bank', price_usd: 135, is_sold: 0 },
];
let purchases = [];
let deposits = [];
let withdrawals = [];
let supportMessages = [];
let premiumMessages = [];
let sessions = {};

const wallets = [
  { currency: 'BTC', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { currency: 'ETH', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' },
  { currency: 'USDT_TRC20', address: 'TXYZopYRdj2D9XRtbG4uTdhUZZ9JdDZsmo' },
  { currency: 'USDT_BEP20', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' }
];

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getSession(req) {
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  const sessionId = cookies?.sessionId;
  if (!sessionId || !sessions[sessionId]) return null;

  // Проверяем, не истекла ли сессия (30 дней)
  const session = sessions[sessionId];
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - session.createdAt > thirtyDays) {
    delete sessions[sessionId];
    return null;
  }

  return session;
}

function setSession(res, userId) {
  const sessionId = generateSessionId();
  sessions[sessionId] = { userId, createdAt: Date.now() };
  // Увеличиваем время жизни cookie до 30 дней
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; Max-Age=2592000; SameSite=Lax`);
  return sessionId;
}

function clearSession(req, res) {
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});

  const sessionId = cookies?.sessionId;
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
  res.setHeader('Set-Cookie', 'sessionId=; Path=/; HttpOnly; Max-Age=0');
}

module.exports = {
  users,
  cards,
  purchases,
  deposits,
  withdrawals,
  supportMessages,
  premiumMessages,
  wallets,
  sessions,
  bcrypt,
  getSession,
  setSession,
  clearSession
};
