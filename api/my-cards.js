const { cards, purchases, getSession } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const userPurchases = purchases.filter(p => p.user_id === session.userId);
    const userCards = userPurchases.map(p => {
      return cards.find(c => c.id === p.card_id);
    }).filter(c => c);

    res.json(userCards);
  } catch (error) {
    console.error('My cards error:', error);
    res.json([]);
  }
};
