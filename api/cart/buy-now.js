const { users, cards, purchases, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    const { cardId } = req.body;

    const card = cards.find(c => c.id === cardId && c.is_sold === 0);
    if (!card) {
      return res.json({ success: false, msg: 'Card not available' });
    }

    const user = users.find(u => u.id === session.userId);
    if (!user) {
      return res.json({ success: false, msg: 'User not found' });
    }

    if (user.balance_usd < card.price_usd) {
      return res.json({ success: false, msg: 'Insufficient balance', redirectToDeposit: true });
    }

    user.balance_usd -= card.price_usd;
    card.is_sold = 1;

    purchases.push({
      id: purchases.length + 1,
      user_id: session.userId,
      card_id: cardId,
      price_paid: card.price_usd,
      purchased_at: new Date().toISOString()
    });

    res.json({ success: true, newBalance: user.balance_usd });
  } catch (error) {
    console.error('Purchase error:', error);
    res.json({ success: false, msg: 'Purchase failed' });
  }
};
