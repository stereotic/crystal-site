const { users, cards, purchases, deposits, withdrawals, supportMessages, premiumMessages, wallets, bcrypt, getSession, setSession, clearSession } = require('./_db');

module.exports = async (req, res) => {
  const path = req.url.split('?')[0];

  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Auth routes
    if (path === '/api/auth/register' && req.method === 'POST') {
      const { username, email, password } = req.body;
      if (!username || username.length < 3) return res.json({ success: false, msg: 'Username must be at least 3 characters' });
      if (!password || password.length < 6) return res.json({ success: false, msg: 'Password must be at least 6 characters' });
      const existingUser = users.find(u => u.username === username);
      if (existingUser) return res.json({ success: false, msg: 'Username already exists' });
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = { id: users.length + 1, username, email: email || null, password: hashedPassword, balance_usd: 0, is_premium: 0, is_worker: 0, created_at: new Date().toISOString() };
      users.push(newUser);
      setSession(res, newUser.id);
      const { password: _, ...userWithoutPassword } = newUser;
      return res.json({ success: true, user: userWithoutPassword });
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const { login, password } = req.body;
      const user = users.find(u => u.username === login || u.email === login);
      if (!user) return res.json({ success: false, msg: 'Invalid credentials' });
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.json({ success: false, msg: 'Invalid credentials' });
      setSession(res, user.id);
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ success: true, user: userWithoutPassword });
    }

    if (path === '/api/auth/me' && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return res.json({ loggedIn: false });
      const user = users.find(u => u.id === session.userId);
      if (!user) return res.json({ loggedIn: false });
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ loggedIn: true, ...userWithoutPassword });
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      clearSession(req, res);
      return res.json({ success: true });
    }

    if (path === '/api/auth/forgot' && req.method === 'POST') {
      return res.json({ success: true, msg: 'Password reset link sent (demo)' });
    }

    if (path === '/api/auth/send-code' && req.method === 'POST') {
      return res.json({ success: true, msg: 'Verification code sent (demo)' });
    }

    // Cards routes
    if (path === '/api/cards' && req.method === 'GET') {
      const { region, type } = req.query;
      let filteredCards = cards.filter(c => c.is_sold === 0);
      if (region && region !== 'all') filteredCards = filteredCards.filter(c => c.region === region);
      if (type && type !== 'all') filteredCards = filteredCards.filter(c => c.type === type);
      return res.json(filteredCards);
    }

    if (path === '/api/regions' && req.method === 'GET') {
      const regions = [...new Set(cards.map(c => c.region))];
      return res.json(regions);
    }

    if (path === '/api/my-cards' && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const userPurchases = purchases.filter(p => p.user_id === session.userId);
      const userCards = userPurchases.map(p => cards.find(c => c.id === p.card_id)).filter(c => c);
      return res.json(userCards);
    }

    if (path === '/api/wallets' && req.method === 'GET') {
      return res.json(wallets);
    }

    if (path === '/api/rates' && req.method === 'GET') {
      return res.json({ BTC: 50000, ETH: 3000, USDT: 1 });
    }

    // Purchase routes
    if (path === '/api/cart/buy-now' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const { cardId } = req.body;
      const card = cards.find(c => c.id === cardId && c.is_sold === 0);
      if (!card) return res.json({ success: false, msg: 'Card not available' });
      const user = users.find(u => u.id === session.userId);
      if (!user) return res.json({ success: false, msg: 'User not found' });
      if (user.balance_usd < card.price_usd) return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
      user.balance_usd -= card.price_usd;
      card.is_sold = 1;
      purchases.push({ id: purchases.length + 1, user_id: session.userId, card_id: cardId, price_paid: card.price_usd, purchased_at: new Date().toISOString() });
      return res.json({ success: true, newBalance: user.balance_usd });
    }

    // Deposit routes
    if (path === '/api/deposit/request' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const { amount, currency } = req.body;
      const wallet = wallets.find(w => w.currency === currency);
      const deposit = { id: deposits.length + 1, user_id: session.userId, amount, currency, wallet_address: wallet?.address || 'N/A', status: 'pending', created_at: new Date().toISOString() };
      deposits.push(deposit);
      return res.json({ success: true, requestId: deposit.id, walletAddress: wallet?.address || 'N/A' });
    }

    if (path === '/api/deposit/check' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const { requestId } = req.body;
      const deposit = deposits.find(d => d.id === requestId && d.user_id === session.userId);
      if (!deposit) return res.json({ status: 'not_found' });
      return res.json({ status: deposit.status });
    }

    // Withdrawal routes
    if (path === '/api/withdraw/request' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const { amount, wallet_address, wallet_currency, password } = req.body;
      const user = users.find(u => u.id === session.userId);
      if (!user) return res.json({ success: false, msg: 'User not found' });
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.json({ success: false, msg: 'Invalid password' });
      if (user.balance_usd < amount) return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
      withdrawals.push({ id: withdrawals.length + 1, user_id: session.userId, amount, wallet_address, wallet_currency, status: 'pending', created_at: new Date().toISOString() });
      return res.json({ success: true });
    }

    // Premium routes
    if (path === '/api/user/buy-premium' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const user = users.find(u => u.id === session.userId);
      if (!user) return res.json({ success: false, msg: 'User not found' });
      if (user.is_premium) return res.json({ success: false, msg: 'Already premium' });
      if (user.balance_usd < 220) return res.json({ success: false, msg: 'Insufficient balance' });
      user.balance_usd -= 220;
      user.is_premium = 1;
      return res.json({ success: true, newBalance: user.balance_usd });
    }

    if (path === '/api/premium/messages' && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const user = users.find(u => u.id === session.userId);
      if (!user || !user.is_premium) return res.json([]);
      return res.json(premiumMessages.slice(-100));
    }

    if (path === '/api/premium/send' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const user = users.find(u => u.id === session.userId);
      if (!user || !user.is_premium) return res.json({ success: false, msg: 'Premium only' });
      const { message } = req.body;
      premiumMessages.push({ id: premiumMessages.length + 1, user_id: session.userId, username: user.username, message, time: new Date().toISOString() });
      return res.json({ success: true });
    }

    // Orders routes
    if (path === '/api/orders/generate' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const user = users.find(u => u.id === session.userId);
      if (!user || !user.is_premium) return res.json({ success: false, msg: 'Premium only' });
      const balance = (Math.random() * 5000 + 100).toFixed(2);
      return res.json({ success: true, balance });
    }

    // Support routes
    if (path === '/api/support/history' && req.method === 'GET') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const messages = supportMessages.filter(m => m.user_id === session.userId);
      return res.json(messages);
    }

    if (path === '/api/support/send' && req.method === 'POST') {
      const session = getSession(req);
      if (!session) return res.status(401).json({ success: false, msg: 'Not authenticated' });
      const { message } = req.body;
      supportMessages.push({ id: supportMessages.length + 1, user_id: session.userId, role: 'user', text: message, file_id: null, file_type: null, time: new Date().toISOString() });
      return res.json({ success: true });
    }

    if (path === '/api/support/upload' && req.method === 'POST') {
      return res.json({ success: true, msg: 'File upload not supported in serverless (demo)' });
    }

    // Ref routes
    if (path === '/api/ref/set' && req.method === 'POST') {
      return res.json({ success: true });
    }

    return res.status(404).json({ success: false, msg: 'Not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ success: false, msg: 'Internal server error' });
  }
};
