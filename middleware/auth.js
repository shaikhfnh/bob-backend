const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { resolvePermissions } = require('../utils/permissions');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided.' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Pull role + overrides fresh from the DB on every request, not just
    // from the token — so a role change takes effect immediately, without
    // waiting for the person's token to expire and them to log in again.
    const [rows] = await db.query('SELECT role, permission_overrides FROM admin_users WHERE id = ?', [decoded.id]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'Account no longer exists.' });

    req.admin = {
      ...decoded,
      role: admin.role,
      permissions: resolvePermissions(admin.role, admin.permission_overrides),
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = requireAuth;