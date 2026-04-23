const { clearSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    clearSession(req, res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({ success: false, msg: 'Logout failed' });
  }
};
