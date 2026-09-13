const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests.' },
});

router.post('/', publicLimiter, async (req, res) => {
  const { visitorId, eventType, sessionId } = req.body;
  try {
    await db.query(
      'INSERT INTO funnel_events (visitor_id, event_type, session_id) VALUES (?, ?, ?)',
      [visitorId, eventType, sessionId || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const [[pageViews]] = await db.query(`SELECT COUNT(DISTINCT visitor_id) AS n FROM funnel_events WHERE event_type = 'page_view'`);
    const [[started]] = await db.query(`SELECT COUNT(DISTINCT visitor_id) AS n FROM funnel_events WHERE event_type = 'form_started'`);
    const [[completed]] = await db.query(`SELECT COUNT(DISTINCT visitor_id) AS n FROM funnel_events WHERE event_type = 'registration_completed'`);
    res.json({ pageViews: pageViews.n, started: started.n, completed: completed.n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/time-to-complete', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        (SELECT MAX(f.created_at) FROM funnel_events f
         WHERE f.visitor_id = r.visitor_id
         AND f.event_type = 'form_started'
         AND f.created_at <= r.created_at
         AND f.created_at >= DATE_SUB(r.created_at, INTERVAL 2 HOUR)
        ) AS started_at,
        r.created_at AS completed_at
      FROM registrants r
      WHERE r.visitor_id IS NOT NULL
    `);
    const diffs = rows
      .filter((r) => r.started_at)
      .map((r) => (new Date(r.completed_at) - new Date(r.started_at)) / 1000)
      .filter((d) => d > 0);
    const avgSeconds = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;
    res.json({ avgSeconds, sampleSize: diffs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/session-leaderboard', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.id, s.title,
        (SELECT COUNT(*) FROM funnel_events WHERE event_type = 'session_card_click' AND session_id = s.id) AS clicks,
        (SELECT COUNT(*) FROM registrants WHERE session_id = s.id) AS registrations
      FROM sessions s
    `);
    res.json(rows.map((r) => ({ ...r, conversionRate: r.clicks > 0 ? Math.round((r.registrations / r.clicks) * 100) : 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/peak-hours', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT HOUR(created_at) AS hour, COUNT(*) AS count FROM registrants GROUP BY hour`);
    const hourly = Array(24).fill(0);
    rows.forEach((r) => { hourly[r.hour] = r.count; });
    res.json(hourly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/dropoff', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT field_name, COUNT(DISTINCT visitor_id) AS count
      FROM funnel_events
      WHERE event_type = 'field_focus'
      AND visitor_id NOT IN (SELECT visitor_id FROM registrants WHERE visitor_id IS NOT NULL)
      GROUP BY field_name ORDER BY count DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sources', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT source, COUNT(*) AS clicks FROM funnel_events
      WHERE event_type = 'session_card_click' AND source IS NOT NULL
      GROUP BY source ORDER BY clicks DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/language-split', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT language, COUNT(DISTINCT visitor_id) AS count FROM funnel_events
      WHERE event_type = 'registration_completed' GROUP BY language
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/device-split', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT device, COUNT(DISTINCT visitor_id) AS count FROM funnel_events
      WHERE event_type = 'registration_completed' GROUP BY device
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/trend', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS count FROM registrants
      GROUP BY DATE(created_at) ORDER BY day ASC LIMIT 30
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;