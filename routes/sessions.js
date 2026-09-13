const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM sessions WHERE status = 'active' ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// everything below requires a valid admin token
router.post('/', requireAuth, async (req, res) => {
  const {
    title, title_ar, date, host,
    description, description_ar,
    speakerName, speaker_name_ar,
    durationMinutes, seatsLimited,
    format, location, capacity, booked, tag,
    topics, topics_ar,
  } = req.body;

  try {
    const [result] = await db.query(
      `INSERT INTO sessions
        (title, title_ar, date, host, description, description_ar,
         speaker_name, speaker_name_ar, duration_minutes, seats_limited,
         format, location, capacity, booked, tag, topics, topics_ar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, title_ar || null, date, host,
        description || null, description_ar || null,
        speakerName || host, speaker_name_ar || null,
        durationMinutes || 90, seatsLimited ? 1 : 0,
        format, location || null, capacity || null, booked || 0, tag || 'UPCOMING',
        topics || null, topics_ar || null,
      ]
    );

    logAction({
      adminEmail: req.admin.email,
      action: 'create_session',
      targetType: 'session',
      targetId: result.insertId,
      targetName: title,
      details: { title, format, date },
    });

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const {
    title, title_ar, date, host,
    description, description_ar,
    speakerName, speaker_name_ar,
    durationMinutes, seatsLimited,
    format, location, capacity, tag,
    topics, topics_ar,
  } = req.body;

  try {
    const [currentRows] = await db.query('SELECT * FROM sessions WHERE id = ?', [req.params.id]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: 'Session not found.' });

    await db.query(
      `UPDATE sessions SET
        title=?, title_ar=?, date=?, host=?,
        description=?, description_ar=?,
        speaker_name=?, speaker_name_ar=?,
        duration_minutes=?, seats_limited=?,
        format=?, location=?, capacity=?, tag=?,
        topics=?, topics_ar=?
       WHERE id=?`,
      [
        title, title_ar || null, date, host,
        description || null, description_ar || null,
        speakerName || host, speaker_name_ar || null,
        durationMinutes || 90, seatsLimited ? 1 : 0,
        format, location || null, capacity || null, tag,
        topics || null, topics_ar || null,
        req.params.id,
      ]
    );

    // Real diff — only fields that actually changed
    const fieldsToCheck = [
      { key: 'title', old: current.title, new: title },
      { key: 'date', old: current.date, new: date },
      { key: 'format', old: current.format, new: format },
      { key: 'location', old: current.location, new: location },
      { key: 'capacity', old: current.capacity, new: capacity },
      { key: 'speakerName', old: current.speaker_name, new: speakerName },
    ];
    const changes = {};
    fieldsToCheck.forEach((f) => {
      if (String(f.old ?? '') !== String(f.new ?? '')) {
        changes[f.key] = { from: f.old, to: f.new };
      }
    });

    logAction({
      adminEmail: req.admin.email,
      action: 'edit_session',
      targetType: 'session',
      targetId: req.params.id,
      targetName: title,
      details: changes,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT title FROM sessions WHERE id = ?', [req.params.id]);
    await db.query('UPDATE sessions SET status = "archived" WHERE id = ?', [req.params.id]);

    logAction({
      adminEmail: req.admin.email,
      action: 'delete_session',
      targetType: 'session',
      targetId: req.params.id,
      targetName: rows[0]?.title || 'Unknown session',
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;