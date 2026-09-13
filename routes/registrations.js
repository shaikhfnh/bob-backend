const express = require('express');
const router = express.Router();
const db = require('../config/db');
const requireAuth = require('../middleware/auth');
const { isValidCivilId } = require('../utils/civilId');
const { sendConfirmationEmail } = require('../services/emailService');
const rateLimit = require('express-rate-limit');
const { logAction } = require('../utils/auditLog');
const { clean } = require('../utils/sanitize');

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests. Please try again later.' },
});

router.post('/', publicLimiter, async (req, res) => {
  const { firstName, lastName, email, phone, civilId, sessionId, consent, visitorId } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

  if (!firstName?.trim()) return res.status(400).json({ error: 'First name is required.' });
  if (!/^\d{8}$/.test(phone || '')) return res.status(400).json({ error: 'Invalid mobile number.' });
  if (!email?.includes('@')) return res.status(400).json({ error: 'Valid email is required.' });
  if (!isValidCivilId(civilId)) return res.status(400).json({ error: 'Invalid Civil ID number.' });
  if (!consent) return res.status(400).json({ error: 'Consent is required to register.' });
  if (!sessionId) return res.status(400).json({ error: 'Session is required.' });

  // Sanitize free-text fields BEFORE they touch the database. Phone and
  // civilId are skipped — they're already constrained to digits-only by
  // the checks above, so there's nothing for xss to strip.
  const cleanFirst = clean(firstName);
  const cleanLast = clean(lastName);
  const cleanEmail = clean(email);

  try {
    const [sessionRows] = await db.query('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    const session = sessionRows[0];
    if (!session) return res.status(400).json({ error: 'Selected session not found.' });

    const [existing] = await db.query(
      'SELECT id FROM registrants WHERE civil_id = ? AND session_id = ?',
      [civilId, sessionId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You are already registered for this session.' });
    }

    if (session.format === 'offline' && session.capacity) {
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) as count FROM registrants WHERE session_id = ?',
        [sessionId]
      );
      if (count >= session.capacity) {
        return res.status(409).json({ error: 'This session is fully booked.' });
      }
    }

    const [newUser] = await db.query(
      'INSERT INTO users (first_name, last_name, email, phone, consent) VALUES (?, ?, ?, ?, ?)',
      [cleanFirst, cleanLast, cleanEmail, phone, consent]
    );
    const userId = newUser.insertId;

    const [result] = await db.query(
      `INSERT INTO registrants (first_name, last_name, email, phone, civil_id, session_id, format, consent, user_id, ip_address, visitor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanFirst, cleanLast, cleanEmail, phone, civilId, sessionId, session.format, consent, userId, ip, visitorId || null]
    );

    res.status(201).json({ success: true, id: result.insertId });

    sendConfirmationEmail({ to: cleanEmail, name: cleanFirst, sessionTitle: session.title })
      .catch((err) => console.error('Confirmation email failed:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, s.title AS session_title, s.date AS session_date
       FROM registrants r
       LEFT JOIN sessions s ON r.session_id = s.id
       ORDER BY r.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const firstName = clean(req.body.firstName);
  const lastName = clean(req.body.lastName);
  const email = clean(req.body.email);
  const { phone, civilId, sessionId } = req.body;
  const bookingId = req.params.id;

  try {
    const [currentRows] = await db.query('SELECT * FROM registrants WHERE id = ?', [bookingId]);
    const current = currentRows[0];
    if (!current) return res.status(404).json({ error: 'Booking not found.' });

    const targetSessionId = sessionId || current.session_id;
    const sessionChanged = String(targetSessionId) !== String(current.session_id);

    const [sessionRows] = await db.query('SELECT * FROM sessions WHERE id = ?', [targetSessionId]);
    const session = sessionRows[0];
    if (!session) return res.status(400).json({ error: 'Selected session not found.' });

    if (sessionChanged) {
      const [dupe] = await db.query(
        'SELECT id FROM registrants WHERE civil_id = ? AND session_id = ? AND id != ?',
        [civilId || current.civil_id, targetSessionId, bookingId]
      );
      if (dupe.length > 0) {
        return res.status(409).json({ error: 'This person is already registered for that session.' });
      }

      if (session.format === 'offline' && session.capacity) {
        const [[{ count }]] = await db.query(
          'SELECT COUNT(*) as count FROM registrants WHERE session_id = ? AND id != ?',
          [targetSessionId, bookingId]
        );
        if (count >= session.capacity) {
          return res.status(409).json({ error: 'That session is fully booked.' });
        }
      }
    }

    await db.query(
      'UPDATE registrants SET first_name = ?, last_name = ?, email = ?, phone = ?, civil_id = ?, session_id = ?, format = ? WHERE id = ?',
      [firstName, lastName, email, phone, civilId, targetSessionId, session.format, bookingId]
    );

    // Build a real diff — only fields that actually changed, showing before/after
    const fieldsToCheck = [
      { key: 'firstName', old: current.first_name, new: firstName },
      { key: 'lastName', old: current.last_name, new: lastName },
      { key: 'email', old: current.email, new: email },
      { key: 'phone', old: current.phone, new: phone },
      { key: 'civilId', old: current.civil_id, new: civilId },
    ];
    if (sessionChanged) {
      fieldsToCheck.push({ key: 'session', old: current.session_id, new: targetSessionId });
    }
    const changes = {};
    fieldsToCheck.forEach((f) => {
      if (String(f.old) !== String(f.new)) {
        changes[f.key] = { from: f.old, to: f.new };
      }
    });

    logAction({
      adminEmail: req.admin.email,
      action: 'edit_booking',
      targetType: 'registrant',
      targetId: bookingId,
      targetName: `${current.first_name} ${current.last_name} (${current.civil_id})`,
      targetCivilId: current.civil_id,
      details: changes,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT first_name, last_name, civil_id FROM registrants WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM registrants WHERE id = ?', [req.params.id]);

    logAction({
      adminEmail: req.admin.email,
      action: 'cancel_booking',
      targetType: 'registrant',
      targetId: req.params.id,
      targetName: rows[0] ? `${rows[0].first_name} ${rows[0].last_name} (${rows[0].civil_id})` : 'Unknown',
      targetCivilId: rows[0]?.civil_id || null,
      details: { name: rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : 'unknown' },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;