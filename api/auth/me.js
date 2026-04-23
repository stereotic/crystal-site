const { users, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);

    if (!session) {
      return res.json({ loggedIn: false });
    }

    const user = users.find(u => u.id === session.userId);

    if (!user) {
      return res.json({ loggedIn: false });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({ loggedIn: true, ...userWithoutPassword });
  } catch (error) {
    console.error('Me error:', error);
    res.json({ loggedIn: false });
  }
};
