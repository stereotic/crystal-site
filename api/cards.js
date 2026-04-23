const { cards } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const { region, type } = req.query;

    let filteredCards = cards.filter(c => c.is_sold === 0);

    if (region && region !== 'all') {
      filteredCards = filteredCards.filter(c => c.region === region);
    }

    if (type && type !== 'all') {
      filteredCards = filteredCards.filter(c => c.type === type);
    }

    res.json(filteredCards);
  } catch (error) {
    console.error('Cards error:', error);
    res.json([]);
  }
};
