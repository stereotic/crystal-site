const { supportMessages, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const messages = supportMessages.filter(m => m.user_id === session.userId);
    res.json(messages);
  } catch (error) {
    console.error('Support history error:', error);
    res.json([]);
  }
};
