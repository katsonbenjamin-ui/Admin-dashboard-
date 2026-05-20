const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.ADMIN_USERNAME || password !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ isAdmin: true, username }, process.env.JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, username });
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ username: p.username, isAdmin: true });
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
});

module.exports = router;
