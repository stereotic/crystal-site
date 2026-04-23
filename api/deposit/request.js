const { users, deposits, wallets, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const { amount, currency } = req.body;

    const wallet = wallets.find(w => w.currency === currency);

    const deposit = {
      id: deposits.length + 1,
      user_id: session.userId,
      amount,
      currency,
      wallet_address: wallet?.address || 'N/A',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    deposits.push(deposit);

    res.json({
      success: true,
      requestId: deposit.id,
      walletAddress: wallet?.address || 'N/A'
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    res.json({ success: false, msg: 'Deposit request failed' });
  }
};
