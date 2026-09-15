const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

const ADMIN_LEVEL_ACTIONS = ['create_admin', 'edit_admin_access', 'remove_admin'];

// General operational log — bookings, sessions, users. Anyone with
// audit_log permission sees this.
router.get('/', requireAuth, requirePermission('audit_log'), async (req, res) => {
  try {
    const placeholders = ADMIN_LEVEL_ACTIONS.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM admin_audit WHERE action NOT IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`,
      ADMIN_LEVEL_ACTIONS
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-level log — who created/edited/removed team accounts. A genuinely
// separate, more sensitive tier — only visible with audit_log_admin.
router.get('/admin', requireAuth, requirePermission('audit_log_admin'), async (req, res) => {
  try {
    const placeholders = ADMIN_LEVEL_ACTIONS.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM admin_audit WHERE action IN (${placeholders}) ORDER BY created_at DESC LIMIT 200`,
      ADMIN_LEVEL_ACTIONS
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;