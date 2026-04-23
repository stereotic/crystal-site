const { users, premiumMessages, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const user = users.find(u => u.id === session.userId);
    if (!user || !user.is_premium) {
      return res.json([]);
    }

    res.json(premiumMessages.slice(-100));
  } catch (error) {
    console.error('Premium messages error:', error);
    res.json([]);
  }
};
