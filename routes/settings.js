const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings');
    const settings = {};
    rows.forEach((r) => { settings[r.key] = r.value === 'true'; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:key', requireAuth, async (req, res) => {
  const { value } = req.body;
  try {
    await db.query('UPDATE settings SET value = ? WHERE `key` = ?', [String(value), req.params.key]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;