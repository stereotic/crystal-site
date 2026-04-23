module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  res.json({
    BTC: 50000,
    ETH: 3000,
    USDT: 1
  });
};
