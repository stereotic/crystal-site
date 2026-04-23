const { supportMessages, getSession } = require('../_db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, msg: 'Method not allowed' });
  }

  try {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ success: false, msg: 'Not authenticated' });
    }

    res.json({ success: true, msg: 'File upload not supported in serverless (demo)' });
  } catch (error) {
    console.error('Support upload error:', error);
    res.json({ success: false, msg: 'Upload failed' });
  }
};
