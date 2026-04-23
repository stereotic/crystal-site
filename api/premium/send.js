const { users, premiumMessages, getSession } = require('../_db');

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

    const { message } = req.body;

    premiumMessages.push({
      id: premiumMessages.length + 1,
      user_id: session.userId,
      username: user.username,
      message,
      time: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Premium send error:', error);
    res.json({ success: false, msg: 'Failed to send message' });
  }
};
