const { supportMessages, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const { message } = req.body;

    supportMessages.push({
      id: supportMessages.length + 1,
      user_id: session.userId,
      role: 'user',
      text: message,
      file_id: null,
      file_type: null,
      time: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Support send error:', error);
    res.json({ success: false, msg: 'Failed to send message' });
  }
};
