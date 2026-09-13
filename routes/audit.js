const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM admin_audit ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;