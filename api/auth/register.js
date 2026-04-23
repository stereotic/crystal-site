const { users, bcrypt, setSession } = require('./_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const { username, email, password } = req.body;

    if (!username || username.length < 3) {
      return res.json({ success: false, msg: 'Username must be at least 3 characters' });
    }

    if (!password || password.length < 6) {
      return res.json({ success: false, msg: 'Password must be at least 6 characters' });
    }

    const existingUser = users.find(u => u.username === username);
    if (existingUser) {
      return res.json({ success: false, msg: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: users.length + 1,
      username,
      email: email || null,
      password: hashedPassword,
      balance_usd: 0,
      is_premium: 0,
      is_worker: 0,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    setSession(res, newUser.id);

    const { password: _, ...userWithoutPassword } = newUser;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Registration error:', error);
    res.json({ success: false, msg: 'Registration failed' });
  }
};
