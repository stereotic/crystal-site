module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  res.json({ success: true, msg: 'Verification code sent (demo)' });
};
