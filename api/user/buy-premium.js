const { users, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const user = users.find(u => u.id === session.userId);
    if (!user) {
      return res.json({ success: false, msg: 'User not found' });
    }

    if (user.is_premium) {
      return res.json({ success: false, msg: 'Already premium' });
    }

    if (user.balance_usd < 220) {
      return res.json({ success: false, msg: 'Insufficient balance' });
    }

    user.balance_usd -= 220;
    user.is_premium = 1;

    res.json({ success: true, newBalance: user.balance_usd });
  } catch (error) {
    console.error('Premium purchase error:', error);
    res.json({ success: false, msg: 'Premium purchase failed' });
  }
};
