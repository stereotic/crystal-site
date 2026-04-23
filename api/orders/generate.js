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
    if (!user || !user.is_premium) {
      return res.json({ success: false, msg: 'Premium only' });
    }

    const balance = (Math.random() * 5000 + 100).toFixed(2);
    res.json({ success: true, balance });
  } catch (error) {
    console.error('Orders generate error:', error);
    res.json({ success: false, msg: 'Failed to generate balance' });
  }
};
