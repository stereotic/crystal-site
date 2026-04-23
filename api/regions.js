const { cards } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const regions = [...new Set(cards.map(c => c.region))];
    res.json(regions);
  } catch (error) {
    console.error('Regions error:', error);
    res.json([]);
  }
};
