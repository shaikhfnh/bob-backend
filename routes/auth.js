const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { resolvePermissions } = require('../utils/permissions');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE email = ?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials.' });

    await db.query('UPDATE admin_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const permissions = resolvePermissions(user.role, user.permission_overrides);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, permissions },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/change-password', require('../middleware/auth'), async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE id = ?', [req.admin.id]);
    const user = rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE admin_users SET password_hash = ? WHERE id = ?', [hash, req.admin.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update-profile', require('../middleware/auth'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
  try {
    await db.query('UPDATE admin_users SET name = ? WHERE id = ?', [name.trim(), req.admin.id]);
    res.json({ success: true, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;