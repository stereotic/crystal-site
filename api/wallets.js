const { wallets } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    res.json(wallets);
  } catch (error) {
    console.error('Wallets error:', error);
    res.json([]);
  }
};
