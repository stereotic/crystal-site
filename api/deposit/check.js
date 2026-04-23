const { deposits, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const { requestId } = req.body;

    const deposit = deposits.find(d => d.id === requestId && d.user_id === session.userId);

    if (!deposit) {
      return res.json({ status: 'not_found' });
    }

    res.json({ status: deposit.status });
  } catch (error) {
    console.error('Deposit check error:', error);
    res.json({ status: 'error' });
  }
};
