const { users, bcrypt, setSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const { login, password } = req.body;

    const user = users.find(u => u.username === login || u.email === login);

    if (!user) {
      return res.json({ success: false, msg: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.json({ success: false, msg: 'Invalid credentials' });
    }

    setSession(res, user.id);

    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.json({ success: false, msg: 'Login failed' });
  }
};
