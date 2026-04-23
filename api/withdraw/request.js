const { users, withdrawals, bcrypt, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const { amount, wallet_address, wallet_currency, password } = req.body;

    const user = users.find(u => u.id === session.userId);
    if (!user) {
      return res.json({ success: false, msg: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ success: false, msg: 'Invalid password' });
    }

    if (user.balance_usd < amount) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    withdrawals.push({
      id: withdrawals.length + 1,
      user_id: session.userId,
      amount,
      wallet_address,
      wallet_currency,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.json({ success: false, msg: 'Withdrawal request failed' });
  }
};
