const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');

router.post('/', async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) return res.json({ success: true });
  try {
    const values = events.map((e) => [e.page, e.xPct, e.yPct, e.device, e.isRageClick, e.isDeadClick]);
    await db.query('INSERT INTO page_events (page, x_pct, y_pct, device, is_rage_click, is_dead_click) VALUES ?', [values]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scroll', async (req, res) => {
  const { page, maxScrollPct, device } = req.body;
  try {
    await db.query('INSERT INTO scroll_events (page, max_scroll_pct, device) VALUES (?, ?, ?)', [page, maxScrollPct, device]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const { page = '/', device, startDate, endDate } = req.query;
  let sql = 'SELECT * FROM page_events WHERE page = ?';
  const params = [page];
  if (device && device !== 'all') { sql += ' AND device = ?'; params.push(device); }
  if (startDate) { sql += ' AND created_at >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND created_at <= ?'; params.push(endDate); }
  sql += ' ORDER BY created_at DESC LIMIT 3000';
  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scroll-summary', requireAuth, async (req, res) => {
  const { page = '/' } = req.query;
  try {
    const [rows] = await db.query('SELECT AVG(max_scroll_pct) AS avg_scroll, COUNT(*) AS sample_size FROM scroll_events WHERE page = ?', [page]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;