const jwt = require('jsonwebtoken');
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (!p.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    req.admin = p;
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}
module.exports = { requireAdmin };
